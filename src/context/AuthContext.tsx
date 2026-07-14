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
import { get, ref, set } from 'firebase/database';
import { ensureUserProfile, createEmployeeProfile } from '../lib/auth-api';
import { completeGoogleRedirectSignIn, signInWithGoogle as firebaseGoogleSignIn } from '../lib/google-auth';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { getPermissions, isVerifiedEmployee, type Permissions } from '../lib/permissions';
import { notifyAdminsOfRegistration } from '../lib/registration-notify';
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

  const usersSnapshot = await get(ref(db, 'users'));
  const isFirstUser = !usersSnapshot.exists();
  const displayName =
    firebaseUser.displayName?.trim() ||
    firebaseUser.email?.split('@')[0] ||
    'Team member';

  const created = await ensureUserProfile(
    firebaseUser.uid,
    firebaseUser.email ?? '',
    displayName,
    isFirstUser,
    photoURL,
  );

  await notifyIfNewPendingProfile(created, 'team', true);
  return created;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  const role = profile?.role;
  const permissions = useMemo(
    () => getPermissions(role, profile?.accountStatus, profile?.employeeId),
    [role, profile?.accountStatus, profile?.employeeId],
  );
  const verifiedEmployee = isVerifiedEmployee(
    role,
    profile?.accountStatus,
    profile?.employeeId,
  );
  const pendingApproval = profile ? needsAdminApproval(profile) : false;

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setLoading(false);
      return;
    }

    let settled = false;
    const finishLoading = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(finishLoading, 8000);

    void completeGoogleRedirectSignIn(auth).catch((error) => {
      console.error('Google redirect sign-in error:', error);
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);
        if (firebaseUser) {
          try {
            const nextProfile = await loadOrCreateProfile(firebaseUser);
            setProfile(nextProfile);
          } catch (error) {
            console.error('Failed to load user profile:', error);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        finishLoading();
      },
      (error) => {
        console.error('Auth state error:', error);
        setProfile(null);
        finishLoading();
      },
    );

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
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

    const usersSnapshot = await get(ref(db, 'users'));
    const isFirstUser = !usersSnapshot.exists();

    if (isFirstUser) {
      const userProfile: UserProfile = {
        uid: credential.user.uid,
        email,
        displayName,
        role: 'admin',
        accountStatus: 'verified',
        createdAt: Date.now(),
      };
      await set(
        ref(db, `users/${credential.user.uid}`),
        serializeUserForDatabase(userProfile),
      );
      setProfile(sanitizeUserProfile(credential.user.uid, userProfile));
      return;
    }

    const userProfile: UserProfile = {
      uid: credential.user.uid,
      email,
      displayName,
      role: 'project_owner',
      accountStatus: 'pending',
      createdAt: Date.now(),
    };

    await set(
      ref(db, `users/${credential.user.uid}`),
      serializeUserForDatabase(userProfile),
    );
    setProfile(sanitizeUserProfile(credential.user.uid, userProfile));
    await notifyIfNewPendingProfile(userProfile, 'team', true);
  };

  const logout = async () => {
    if (!auth) return;
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
