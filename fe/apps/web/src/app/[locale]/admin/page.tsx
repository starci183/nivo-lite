import { loadWorkspaceList } from "@/features/admin/queries";
import { Shell } from "@/features/admin/Shell";
import { WorkspacesView, type WorkspaceFilter } from "@/features/admin/WorkspacesView";
import { audit, requirePlatformAdmin } from "@/lib/platform-admin";

const FILTERS: ReadonlyArray<WorkspaceFilter> = ["attention", "unpaid", "idle"];

/** /admin: every customer workspace with status, modules, connections and activity. */
const Page = async ({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) => {
  const admin = await requirePlatformAdmin();
  const { f, q } = await searchParams;
  const filter = FILTERS.find((x) => x === f) ?? "all";
  const query = (q ?? "").slice(0, 120);
  await audit(admin, "view.workspaces", null, { filter, q: query });
  const items = await loadWorkspaceList();
  return <Shell email={admin.email} current="workspaces"><WorkspacesView items={items} filter={filter} q={query} now={Date.now()} /></Shell>;
};

export default Page;
