import { AgentSetupView } from "@/features/modules/AgentSetupView";
import { listAgentConversationRows } from "@/features/modules/queries";
import { notFound } from "next/navigation";
import { getAgent } from "@/lib/queries";

type AgentSetupPageProps = { params: Promise<{ agentId: string }> };

/** Setup page of one installed agent. */
const AgentSetupPage = async ({ params }: AgentSetupPageProps) => {
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  if (agent === null) notFound();
  const conversations = await listAgentConversationRows(agent.id);
  return <AgentSetupView agent={agent} conversations={conversations} />;
};

export default AgentSetupPage;
