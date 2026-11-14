import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, isSupported as isMessagingSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// CRITICAL: Pass firebaseConfig.firestoreDatabaseId to connect to the provisioned Enterprise Firestore instance
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore client is offline. Please verify your Firebase configuration.');
    }
  }
}

void testFirestoreConnection();

export interface PushSetupResult {
  enabled: boolean;
  token?: string;
  message: string;
}

export async function enablePushNotifications(vapidKey?: string): Promise<PushSetupResult> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { enabled: false, message: 'Browser notifications are not supported in this environment.' };
    }
    const supported = await isMessagingSupported();
    if (!supported) {
      return { enabled: false, message: 'Firebase Cloud Messaging is not supported in this browser/iframe.' };
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { enabled: false, message: 'Browser notification permission was not granted.' };
    }
    const key = (vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
    if (!key) {
      return {
        enabled: false,
        message:
          'In-app real-time Firestore notifications are active. To enable background browser push via FCM, add a Web Push VAPID key in Firebase Console > Project Settings > Cloud Messaging and set VITE_FIREBASE_VAPID_KEY.',
      };
    }
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: key });
    if (!token) {
      return { enabled: false, message: 'Could not obtain an FCM registration token.' };
    }
    return { enabled: true, token, message: 'Firebase Cloud Messaging browser push active.' };
  } catch (err) {
    return {
      enabled: false,
      message: err instanceof Error ? err.message : 'Unable to initialize FCM push notifications.',
    };
  }
}
