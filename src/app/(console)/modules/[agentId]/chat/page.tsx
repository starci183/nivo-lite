import { notFound } from "next/navigation";
import { AgentChat } from "@/features/agent-chat";
import { getAgent } from "@/lib/queries";
import { isFoundingMember } from "@/features/promo-ads/queries";

type AgentChatPageProps = {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ tab?: string; c?: string; welcome?: string }>;
};

/** Agent chat: owner test conversation and the simulated customer channel (`?tab=customer`). */
const AgentChatPage = async (props: AgentChatPageProps) => {
  const { agentId } = await props.params;
  const { tab, c, welcome } = await props.searchParams;
  const agent = await getAgent(agentId);
  if (!agent) notFound();
  const showWelcome = welcome === "1" && agent.module === "chatbot" && (await isFoundingMember());
  return (
    <AgentChat
      agent={{ id: agent.id, module: agent.module, name: agent.name, handle: agent.handle, role: agent.role, isActive: agent.status === "active", hasCustomerChannel: agent.module === "chatbot" }}
      initialTab={tab === "customer" ? "customer" : "test"}
      initialConversationId={c ?? null}
      showWelcome={showWelcome}
    />
  );
};

export default AgentChatPage;
