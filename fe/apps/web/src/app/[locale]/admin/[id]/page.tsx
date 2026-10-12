import { notFound } from "next/navigation";
import { loadWorkspaceDetail } from "@/features/admin/queries";
import { Shell } from "@/features/admin/Shell";
import { WorkspaceDetailView } from "@/features/admin/WorkspaceDetailView";
import { audit, requirePlatformAdmin } from "@/lib/platform-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /admin/[id]: read-only overview of one workspace and the confirmed support actions. */
const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await loadWorkspaceDetail(id);
  if (!data) notFound();
  await audit(admin, "view.workspace", id);
  return <Shell email={admin.email} current="workspaces"><WorkspaceDetailView data={data} now={Date.now()} /></Shell>;
};

export default Page;
