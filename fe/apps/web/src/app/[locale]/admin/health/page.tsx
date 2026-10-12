import { HealthView } from "@/features/admin/HealthView";
import { loadHealth } from "@/features/admin/queries";
import { Shell } from "@/features/admin/Shell";
import { audit, requirePlatformAdmin } from "@/lib/platform-admin";

/** /admin/health: engine, queue, failures, sign-ups, billing events and application errors. */
const Page = async () => {
  const admin = await requirePlatformAdmin();
  await audit(admin, "view.health", null);
  const data = await loadHealth();
  return <Shell email={admin.email} current="health"><HealthView data={data} now={Date.now()} /></Shell>;
};

export default Page;
