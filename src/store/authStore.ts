import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase.ts';
import {
  createFullRoleRegistration,
  fetchRoleProfile,
  fetchUserAccount,
  type CareOneRole,
  type UserAccountDoc,
} from '../services/careoneDb.ts';

export type UserRole = CareOneRole;
export type AuthUser = UserAccountDoc;

interface PendingRegistrationDraft {
  role: CareOneRole;
  fullName: string;
  phone?: string;
  photoUrl?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string;
  chronicConditions?: string;
  qualification?: string;
  specialization?: string;
  licenseNo?: string;
  experienceYears?: number;
  consultationFee?: number;
  hospitalId?: string;
  hospitalName?: string;
  bio?: string;
  availableDays?: string[];
  slotStartTime?: string;
  slotEndTime?: string;
  availableOnline?: boolean;
  availableInPerson?: boolean;
  organizationName?: string;
  city?: string;
  state?: string;
  address?: string;
  departments?: string[];
  facilities?: string[];
  operatingHours?: string;
}

const DRAFT_STORAGE_PREFIX = 'careone_pending_reg_';

function saveDraftForUid(uid: string, draft: PendingRegistrationDraft) {
  try {
    localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${uid}`, JSON.stringify(draft));
  } catch {
    // Ignore storage quota errors
  }
}

function loadDraftForUid(uid: string): PendingRegistrationDraft | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${uid}`);
    return raw ? (JSON.parse(raw) as PendingRegistrationDraft) : null;
  } catch {
    return null;
  }
}

function clearDraftForUid(uid: string) {
  try {
    localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${uid}`);
  } catch {
    // Ignore
  }
}

function formatFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). Please use Continue with Google or enable Email/Password in Firebase Console.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password. Please verify your credentials.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup was blocked by the browser. Please allow popups for this site and try again.';
  }
  return msg;
}

interface AuthState {
  firebaseUser: User | null;
  user: UserAccountDoc | null;
  profile: Record<string, any> | null;
  needsOnboarding: boolean;
  emailVerificationRequired: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initAuth: () => () => void;
  signInWithGoogle: () => Promise<{ account: UserAccountDoc | null; needsOnboarding: boolean }>;
  loginWithEmail: (email: string, password: string) => Promise<{ account: UserAccountDoc | null; needsOnboarding: boolean; emailVerificationRequired: boolean }>;
  registerWithEmail: (
    email: string,
    password: string,
    draft: PendingRegistrationDraft
  ) => Promise<{ emailVerificationRequired: boolean; account: UserAccountDoc | null }>;
  completeOnboarding: (draft: PendingRegistrationDraft) => Promise<UserAccountDoc>;
  refreshVerificationStatus: () => Promise<{ verified: boolean; account: UserAccountDoc | null }>;
  resendVerificationEmail: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

let unsubAuth: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  const hydrateFromFirebaseUser = async (fbUser: User | null) => {
    if (!fbUser) {
      set({
        firebaseUser: null,
        user: null,
        profile: null,
        needsOnboarding: false,
        emailVerificationRequired: false,
        isInitialized: true,
      });
      return;
    }

    if (!fbUser.emailVerified) {
      set({
        firebaseUser: fbUser,
        user: null,
        profile: null,
        needsOnboarding: false,
        emailVerificationRequired: true,
        isInitialized: true,
      });
      return;
    }

    try {
      const account = await fetchUserAccount(fbUser.uid);
      if (account) {
        const profile = await fetchRoleProfile(fbUser.uid, account.role);
        clearDraftForUid(fbUser.uid);
        set({
          firebaseUser: fbUser,
          user: account,
          profile,
          needsOnboarding: false,
          emailVerificationRequired: false,
          isInitialized: true,
        });
        return;
      }

      // Check if an email-verified user had a pending registration draft saved from signup
      const pendingDraft = loadDraftForUid(fbUser.uid);
      if (pendingDraft) {
        const result = await createFullRoleRegistration({
          uid: fbUser.uid,
          email: fbUser.email || '',
          ...pendingDraft,
        });
        clearDraftForUid(fbUser.uid);
        const freshProfile = await fetchRoleProfile(fbUser.uid, result.user.role);
        set({
          firebaseUser: fbUser,
          user: result.user,
          profile: freshProfile || result.profile,
          needsOnboarding: false,
          emailVerificationRequired: false,
          isInitialized: true,
        });
        return;
      }

      set({
        firebaseUser: fbUser,
        user: null,
        profile: null,
        needsOnboarding: true,
        emailVerificationRequired: false,
        isInitialized: true,
      });
    } catch (err) {
      set({
        firebaseUser: fbUser,
        user: null,
        profile: null,
        needsOnboarding: false,
        emailVerificationRequired: false,
        isInitialized: true,
        error: err instanceof Error ? err.message : 'Unable to load CareOne profile.',
      });
    }
  };

  return {
    firebaseUser: null,
    user: null,
    profile: null,
    needsOnboarding: false,
    emailVerificationRequired: false,
    isInitialized: false,
    isLoading: false,
    error: null,

    initAuth: () => {
      if (unsubAuth) return unsubAuth;
      unsubAuth = onAuthStateChanged(auth, (fbUser) => {
        void hydrateFromFirebaseUser(fbUser);
      });
      return unsubAuth;
    },

    signInWithGoogle: async () => {
      set({ isLoading: true, error: null });
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        await hydrateFromFirebaseUser(cred.user);
        set({ isLoading: false });
        return {
          account: get().user,
          needsOnboarding: get().needsOnboarding,
        };
      } catch (err) {
        const msg = formatFirebaseAuthError(err);
        set({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    },

    loginWithEmail: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await hydrateFromFirebaseUser(cred.user);
        set({ isLoading: false });
        return {
          account: get().user,
          needsOnboarding: get().needsOnboarding,
          emailVerificationRequired: get().emailVerificationRequired,
        };
      } catch (err) {
        const msg = formatFirebaseAuthError(err);
        set({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    },

    registerWithEmail: async (email, password, draft) => {
      set({ isLoading: true, error: null });
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (draft.fullName) {
          await updateProfile(cred.user, {
            displayName: draft.fullName,
            photoURL: draft.photoUrl || undefined,
          }).catch(() => {});
        }
        saveDraftForUid(cred.user.uid, draft);

        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          await hydrateFromFirebaseUser(cred.user);
          set({ isLoading: false });
          return { emailVerificationRequired: true, account: null };
        }

        await hydrateFromFirebaseUser(cred.user);
        set({ isLoading: false });
        return { emailVerificationRequired: false, account: get().user };
      } catch (err) {
        const msg = formatFirebaseAuthError(err);
        set({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    },

    completeOnboarding: async (draft) => {
      const fbUser = auth.currentUser;
      if (!fbUser) {
        throw new Error('Please sign in first.');
      }
      set({ isLoading: true, error: null });
      try {
        const result = await createFullRoleRegistration({
          uid: fbUser.uid,
          email: fbUser.email || '',
          ...draft,
          photoUrl: draft.photoUrl || fbUser.photoURL || '',
        });
        clearDraftForUid(fbUser.uid);
        const freshProfile = await fetchRoleProfile(fbUser.uid, result.user.role);
        set({
          user: result.user,
          profile: freshProfile || result.profile,
          needsOnboarding: false,
          emailVerificationRequired: false,
          isLoading: false,
        });
        return result.user;
      } catch (err) {
        const msg = formatFirebaseAuthError(err);
        set({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    },

    refreshVerificationStatus: async () => {
      const fbUser = auth.currentUser;
      if (!fbUser) return { verified: false, account: null };
      set({ isLoading: true, error: null });
      try {
        await fbUser.reload();
        const refreshed = auth.currentUser;
        await hydrateFromFirebaseUser(refreshed);
        set({ isLoading: false });
        return {
          verified: Boolean(refreshed?.emailVerified),
          account: get().user,
        };
      } catch (err) {
        const msg = formatFirebaseAuthError(err);
        set({ isLoading: false, error: msg });
        return { verified: false, account: null };
      }
    },

    resendVerificationEmail: async () => {
      const fbUser = auth.currentUser;
      if (!fbUser) return;
      set({ isLoading: true, error: null });
      try {
        await sendEmailVerification(fbUser);
        set({ isLoading: false });
      } catch (err) {
        const msg = formatFirebaseAuthError(err);
        set({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    },

    refreshProfile: async () => {
      const currentUser = get().user;
      if (!currentUser) return;
      const profile = await fetchRoleProfile(currentUser.uid, currentUser.role);
      set({ profile });
    },

    getIdToken: async () => {
      if (!auth.currentUser) return null;
      return auth.currentUser.getIdToken();
    },

    logout: async () => {
      try {
        await signOut(auth);
      } finally {
        set({
          firebaseUser: null,
          user: null,
          profile: null,
          needsOnboarding: false,
          emailVerificationRequired: false,
          error: null,
        });
      }
    },

    clearError: () => set({ error: null }),
  };
});
