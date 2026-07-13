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
import { ensureUserProfile } from '../lib/auth-api';
import { completeGoogleRedirectSignIn, signInWithGoogle as firebaseGoogleSignIn } from '../lib/google-auth';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { getPermissions, type Permissions } from '../lib/permissions';
import { sanitizeUserProfile } from '../lib/users';
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
  ) => Promise<void>;
  logout: () => Promise<void>;
  role: UserRole | undefined;
  isAdmin: boolean;
  isViewer: boolean;
  isProjectOwner: boolean;
  permissions: Permissions;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadOrCreateProfile(firebaseUser: User): Promise<UserProfile | null> {
  if (!db) return null;

  const snapshot = await get(ref(db, `users/${firebaseUser.uid}`));
  if (snapshot.exists()) {
    return sanitizeUserProfile(firebaseUser.uid, snapshot.val() as UserProfile);
  }

  const usersSnapshot = await get(ref(db, 'users'));
  const isFirstUser = !usersSnapshot.exists();
  const displayName =
    firebaseUser.displayName?.trim() ||
    firebaseUser.email?.split('@')[0] ||
    'Team member';

  return ensureUserProfile(
    firebaseUser.uid,
    firebaseUser.email ?? '',
    displayName,
    isFirstUser,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  const role = profile?.role;
  const permissions = useMemo(() => getPermissions(role), [role]);

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
  ) => {
    if (!auth || !db) throw new Error('Firebase is not configured');

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const usersSnapshot = await get(ref(db, 'users'));
    const isFirstUser = !usersSnapshot.exists();
    const userRole: UserRole = isFirstUser ? 'admin' : 'project_owner';

    const userProfile: UserProfile = {
      uid: credential.user.uid,
      email,
      displayName,
      role: userRole,
      createdAt: Date.now(),
    };

    await set(ref(db, `users/${credential.user.uid}`), userProfile);
    setProfile(sanitizeUserProfile(credential.user.uid, userProfile));
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
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
        role,
        isAdmin: role === 'admin',
        isViewer: role === 'viewer',
        isProjectOwner: role === 'project_owner',
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
