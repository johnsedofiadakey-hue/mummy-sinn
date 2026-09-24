import { adminDb } from "@/lib/firebase/admin";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { getSettings } from "@/lib/admin/repository";
import { displayGhPhone } from "@/lib/phone";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Kitchen settings" };

export default async function AdminSettingsPage() {
  const staff = await requireAdminPage("settings.read");
  const settings = await getSettings(adminDb);
  return <>
    <h1 className="text-2xl font-black md:text-3xl">Kitchen settings</h1>
    <p className="mb-6 mt-1 text-sm text-stone-600">These are the only settings students can see. Every change is recorded in the audit log.</p>
    {!settings.exists && <p className="mb-5 rounded-xl bg-mango/20 px-4 py-3 text-sm font-bold">Not saved yet. Students currently see the built-in defaults (open, ASAP on).</p>}
    <div className="max-w-xl">
      <SettingsForm canWrite={can(staff, "settings.write")} initial={{
        acceptingOrders: settings.exists ? settings.acceptingOrders : true, asapEnabled: settings.exists ? settings.asapEnabled : true,
        notice: settings.notice ?? "", supportPhone: settings.supportPhone?.startsWith("+233") ? displayGhPhone(settings.supportPhone) : settings.supportPhone ?? "",
      }} />
    </div>
  </>;
}
