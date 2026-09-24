// Guarded first-owner bootstrap. It never creates an Auth user and never overwrites a role or staff record.
// Usage:
// GOOGLE_CLOUD_PROJECT=mummy-sinn npx tsx scripts/bootstrap-owner.mts \
//   --project mummy-sinn --uid <firebase-auth-uid> --email <staff-email> --confirm
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const value = (name: string) => args[args.indexOf(name) + 1];
const project = value("--project"); const uid = value("--uid"); const email = value("--email")?.trim().toLowerCase();
if (!args.includes("--confirm") || !project || !uid || !email || !args.includes("--project") || !args.includes("--uid") || !args.includes("--email")) {
  console.error("Usage: npx tsx scripts/bootstrap-owner.mts --project <project> --uid <uid> --email <email> --confirm");
  process.exit(1);
}

const app = initializeApp({ projectId: project }); const auth = getAuth(app); const db = getFirestore(app);
const user = await auth.getUser(uid);
if ((user.email ?? "").trim().toLowerCase() !== email) {
  console.error("Refusing: the Firebase Auth UID does not belong to the supplied email.");
  process.exit(1);
}
if (user.disabled) {
  console.error("Refusing: the Firebase Auth user is disabled.");
  process.exit(1);
}

const ownerRole = db.doc("roles/owner"); const staff = db.doc(`staff/${uid}`);
const [roleSnap, staffSnap] = await db.getAll(ownerRole, staff);
if (staffSnap.exists) {
  console.error("Refusing: this UID already has a staff record. Inspect it before changing access.");
  process.exit(1);
}
if (roleSnap.exists) {
  console.error("Refusing: roles/owner already exists. Inspect it before changing access.");
  process.exit(1);
}

const permissions = ["dashboard.read", "menu.read", "menu.write", "promotions.read", "promotions.write", "settings.read", "settings.write", "uploads.write"];
const now = FieldValue.serverTimestamp();
const batch = db.batch();
batch.create(ownerRole, { name: "Owner", isActive: true, permissions, createdAt: now, updatedAt: now });
batch.create(staff, { authUid: uid, displayName: user.displayName?.trim() || email.split("@")[0], roleIds: ["owner"], isActive: true, email, createdAt: now, updatedAt: now });
await batch.commit();
console.log(`Created roles/owner and active staff/${uid} for ${email}.`);
