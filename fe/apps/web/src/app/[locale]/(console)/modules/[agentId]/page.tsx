import { notFound, redirect } from "next/navigation";
import { listInstallations } from "@/lib/modules-core";
import { agentHref, isModuleKey } from "@/lib/modules-shared";
import { getAgent } from "@/lib/queries";

type AgentPageProps = { params: Promise<{ agentId: string }> };

/** Moved: an agent's setup lives in its instance (/agents/<module>/<installationId>). The agent chat pages below keep working. */
const AgentPage = async ({ params }: AgentPageProps) => {
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  if (agent === null) notFound();
  const own = (await listInstallations()).find((i) => i.agentId === agent.id);
  redirect(own ? agentHref(own.moduleKey, own.id) : isModuleKey(agent.module) ? agentHref(agent.module, null) : "/agents");
};

export default AgentPage;
