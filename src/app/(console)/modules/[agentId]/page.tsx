import { notFound, redirect } from "next/navigation";
import { getAgent } from "@/lib/queries";

type AgentPageProps = { params: Promise<{ agentId: string }> };

/** Moved: an agent's setup lives in its module (/m/<module>). The agent chat pages below keep working. */
const AgentPage = async ({ params }: AgentPageProps) => {
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  if (agent === null) notFound();
  redirect(`/m/${agent.module}`);
};

export default AgentPage;
