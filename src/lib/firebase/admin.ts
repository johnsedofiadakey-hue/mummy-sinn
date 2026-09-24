import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
// App Hosting/Cloud Run can use Application Default Credentials; local development uses an explicit service account.
export const isFirebaseAdminConfigured = () => Boolean(
  (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && privateKey)
  || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
);
export const adminApp = getApps().length ? getApps()[0] : initializeApp(
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL && privateKey
    ? { credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) }
    : undefined,
);
export const adminDb = getFirestore(adminApp);
