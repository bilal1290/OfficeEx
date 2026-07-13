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
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { getPermissions, type Permissions } from '../lib/permissions';
import type { UserProfile, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);
        if (firebaseUser) {
          try {
            const snapshot = await get(ref(db!, `users/${firebaseUser.uid}`));
            setProfile(snapshot.exists() ? (snapshot.val() as UserProfile) : null);
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
    setProfile(userProfile);
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
