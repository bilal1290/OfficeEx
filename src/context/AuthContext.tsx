import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { get, onValue, ref, set } from 'firebase/database';
import { ensureUserProfile, createEmployeeProfile } from '../lib/auth-api';
import { resolveBootstrapRole } from '../lib/bootstrap-admin';
import { isUserRevoked } from '../lib/user-admin';
import { completeGoogleRedirectSignIn, signInWithGoogle as firebaseGoogleSignIn } from '../lib/google-auth';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { getPermissions, isVerifiedEmployee, type Permissions } from '../lib/permissions';
import { useRolePermissions } from './RolePermissionsContext';
import { notifyAdminsOfRegistration } from '../lib/registration-notify';
import { signOutSupabase, syncSupabaseSession } from '../lib/supabase-auth';
import { isAccountApproved, needsAdminApproval } from '../lib/account-status';
import { resolveAuthPhotoUrl, sanitizeUserProfile, isCustomProfilePhoto, serializeUserForDatabase } from '../lib/users';
import type { UserProfile, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    asEmployee?: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfilePhoto: (photoURL: string | null) => Promise<void>;
  role: UserRole | undefined;
  isAdmin: boolean;
  isViewer: boolean;
  isProjectOwner: boolean;
  isEmployee: boolean;
  isVerifiedEmployee: boolean;
  isPendingApproval: boolean;
  permissions: Permissions;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function notifyIfNewPendingProfile(
  profile: UserProfile,
  registrationKind: 'team' | 'employee',
  isNewProfile: boolean,
): Promise<void> {
  if (!isNewProfile || isAccountApproved(profile)) return;
  if (profile.accountStatus !== 'pending') return;

  await notifyAdminsOfRegistration({
    displayName: profile.displayName,
    email: profile.email,
    registrationKind,
  });
}

async function loadOrCreateProfile(firebaseUser: User): Promise<UserProfile | null> {
  if (!db) return null;

  const photoURL = resolveAuthPhotoUrl(firebaseUser.photoURL);
  const snapshot = await get(ref(db, `users/${firebaseUser.uid}`));

  const revoked = await isUserRevoked(firebaseUser.uid);
  if (revoked) {
    throw new Error('This account was removed by an administrator.');
  }

  if (snapshot.exists()) {
    const existing = sanitizeUserProfile(
      firebaseUser.uid,
      snapshot.val() as UserProfile,
    );
    if (!existing) return null;

    if (
      photoURL &&
      !isCustomProfilePhoto(existing.photoURL) &&
      existing.photoURL !== photoURL
    ) {
      const updated: UserProfile = {
        ...existing,
        photoURL,
        updatedAt: Date.now(),
      };
      await set(
        ref(db, `users/${firebaseUser.uid}`),
        serializeUserForDatabase(updated),
      );
      return updated;
    }

    return existing;
  }

  const displayName =
    firebaseUser.displayName?.trim() ||
    firebaseUser.email?.split('@')[0] ||
    'Team member';

  const bootstrap = await resolveBootstrapRole(firebaseUser.uid);

  const created = await ensureUserProfile(
    firebaseUser.uid,
    firebaseUser.email ?? '',
    displayName,
    bootstrap.role === 'admin',
    photoURL,
    bootstrap.accountStatus,
  );

  await notifyIfNewPendingProfile(created, 'team', true);
  return created;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { config: rolePermissionsConfig, loading: rolePermissionsLoading } =
    useRolePermissions();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const loading = authLoading || rolePermissionsLoading;

  const role = profile?.role;
  const permissions = useMemo(
    () =>
      getPermissions(
        role,
        profile?.accountStatus,
        profile?.employeeId,
        rolePermissionsConfig,
      ),
    [role, profile?.accountStatus, profile?.employeeId, rolePermissionsConfig],
  );
  const verifiedEmployee = isVerifiedEmployee(
    role,
    profile?.accountStatus,
    profile?.employeeId,
  );
  const pendingApproval = profile ? needsAdminApproval(profile) : false;

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setAuthLoading(false);
      return;
    }

    let profileUnsubscribe: (() => void) | undefined;
    let profileReady = false;

    const markProfileReady = () => {
      if (!profileReady) {
        profileReady = true;
        setAuthLoading(false);
      }
    };

    void completeGoogleRedirectSignIn(auth).catch((error) => {
      console.error('Google redirect sign-in error:', error);
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        profileUnsubscribe?.();
        profileUnsubscribe = undefined;
        profileReady = false;
        setUser(firebaseUser);

        if (!firebaseUser) {
          setProfile(null);
          markProfileReady();
          try {
            await signOutSupabase();
          } catch (error) {
            console.warn('Supabase sign-out failed:', error);
          }
          return;
        }

        setAuthLoading(true);

        try {
          const nextProfile = await loadOrCreateProfile(firebaseUser);
          setProfile(nextProfile);
          if (nextProfile && isAccountApproved(nextProfile)) {
            try {
              await syncSupabaseSession(firebaseUser, nextProfile.displayName);
            } catch (error) {
              console.error('Supabase chat session sync failed:', error);
            }
          }
        } catch (error) {
          console.error('Failed to load user profile:', error);
          setProfile(null);
        } finally {
          markProfileReady();
        }

        if (!firebaseUser || !db) {
          return;
        }

        const profileRef = ref(db, `users/${firebaseUser.uid}`);
        profileUnsubscribe = onValue(profileRef, (snapshot) => {
          if (!snapshot.exists()) return;

          const liveProfile = sanitizeUserProfile(
            firebaseUser.uid,
            snapshot.val() as UserProfile,
          );
          if (!liveProfile) return;

          setProfile((current) => {
            const becameApproved =
              current &&
              !isAccountApproved(current) &&
              isAccountApproved(liveProfile);

            if (becameApproved) {
              void syncSupabaseSession(firebaseUser, liveProfile.displayName).catch(
                (error) => {
                  console.error('Supabase chat session sync failed:', error);
                },
              );
            }

            return liveProfile;
          });
        });
      },
      (error) => {
        console.error('Auth state error:', error);
        setProfile(null);
        markProfileReady();
      },
    );

    return () => {
      unsubscribe();
      profileUnsubscribe?.();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    await firebaseGoogleSignIn(auth);
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
    asEmployee = false,
  ) => {
    if (!auth || !db) throw new Error('Firebase is not configured');

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    if (asEmployee) {
      const userProfile = await createEmployeeProfile(
        credential.user.uid,
        email,
        displayName,
      );
      const saved = sanitizeUserProfile(credential.user.uid, userProfile);
      setProfile(saved);
      await notifyIfNewPendingProfile(userProfile, 'employee', true);
      return;
    }

    const bootstrap = await resolveBootstrapRole(credential.user.uid);

    const userProfile: UserProfile = {
      uid: credential.user.uid,
      email,
      displayName,
      role: bootstrap.role,
      accountStatus: bootstrap.accountStatus,
      createdAt: Date.now(),
    };

    await set(
      ref(db, `users/${credential.user.uid}`),
      serializeUserForDatabase(userProfile),
    );
    setProfile(sanitizeUserProfile(credential.user.uid, userProfile));

    if (bootstrap.accountStatus === 'pending') {
      await notifyIfNewPendingProfile(userProfile, 'team', true);
    }
    return;
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await signOutSupabase();
    } catch (error) {
      console.warn('Supabase sign-out failed:', error);
    }
    await signOut(auth);
  };

  const updateProfilePhoto = async (photoURL: string | null) => {
    if (!db || !profile) {
      throw new Error('Profile is not available.');
    }

    const updated: UserProfile = {
      ...profile,
      updatedAt: Date.now(),
    };

    if (photoURL === null) {
      delete updated.photoURL;
    } else {
      updated.photoURL = photoURL;
    }

    await set(
      ref(db, `users/${profile.uid}`),
      serializeUserForDatabase(updated),
    );
    setProfile(sanitizeUserProfile(profile.uid, updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        updateProfilePhoto,
        role,
        isAdmin: role === 'admin',
        isViewer: role === 'viewer',
        isProjectOwner: role === 'project_owner',
        isEmployee: role === 'employee',
        isVerifiedEmployee: verifiedEmployee,
        isPendingApproval: pendingApproval,
        permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
