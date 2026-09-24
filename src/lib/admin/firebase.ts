import "server-only";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase/admin";

export const adminAuth = () => getAuth(adminApp);

/** Server bucket name. Falls back to the public web config value, which names the same bucket. */
export const storageBucketName = () => process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
export const adminBucket = () => {
  const name = storageBucketName();
  if (!name) throw new Error("FIREBASE_STORAGE_BUCKET is not configured.");
  return getStorage(adminApp).bucket(name);
};
