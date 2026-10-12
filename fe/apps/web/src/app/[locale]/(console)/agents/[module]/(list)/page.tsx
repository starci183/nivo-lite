import { notFound, redirect } from "next/navigation";
import { InstanceList, type InstanceRow } from "@/features/agent-instances/InstanceList";
import { listConnections } from "@/lib/channels";
import { resolveTypeRoute } from "@/lib/agent-routes";
import { isManagerRole } from "@/lib/members-shared";
import { listInstances } from "@/lib/modules-core";
import { isModuleKey } from "@/lib/modules-shared";
import { getSession } from "@/lib/session";

type TypePageProps = {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * /agents/<type>: the only instance opens directly (its Setup tab); several instances, or ?list=1, show the list of instances with
 * "Thêm <loại> mới" for multi-instance types. Not installed: back to the catalogue.
 */
const AgentTypePage = async ({ params, searchParams }: TypePageProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const search = await searchParams;
  if (!search.list) {
    const target = await resolveTypeRoute(module, "setup", search);
    if (target) redirect(target);
  }
  const [session, instances] = await Promise.all([getSession(), listInstances(module)]);
  if (instances.length === 0) redirect("/agents");
  const connections = await listConnections(session.workspace.id);
  const rows: Array<InstanceRow> = instances.map((installation) => ({
    installation,
    connections: installation.agentId ? connections.filter((c) => c.status !== "disconnected" && c.agentIds.includes(installation.agentId as string)).map((c) => c.name) : [],
  }));
  return <InstanceList moduleKey={module} rows={rows} canInstall={isManagerRole(session.member.role)} />;
};

export default AgentTypePage;
