import { getSession } from "@/lib/session";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { loadChatbotOverview, loadChatbotThread } from "@/lib/workbench-chatbot";
import { ChatbotWorkbench } from "./workbench";

type ChatbotWorkbenchPageProps = {
  /** `?focus=` of the route: the conversation a "Chờ bạn" row leads to. */
  readonly focus?: string | null;
};

/**
 * Chatbot workbench (customer conversations): server component that loads the inbox, the agent dashboard regions and the open thread,
 * then hands over to the realtime client. Rendered by the module workbench switch for module "chatbot".
 * A "Chờ bạn" row opens the conversation it asks about (`?focus=<conversation id>`), else the newest conversation opens.
 */
export default async function ChatbotWorkbenchPage({ focus = null }: ChatbotWorkbenchPageProps = {}) {
  const [session, overview, dashboard] = await Promise.all([
    getSession(),
    loadChatbotOverview(),
    loadAgentDashboard("chatbot", {
      decisionHref: (item) => {
        const conversation = item.proposal.fields?.conversation_id;
        return workbenchHref("chatbot", { focus: typeof conversation === "string" ? conversation : (item.subject_id ?? undefined) });
      },
    }),
  ]);
  const first = overview.conversations.find((c) => c.id === focus) ?? overview.conversations[0] ?? null;
  const thread = first ? await loadChatbotThread(first.id) : null;
  return <ChatbotWorkbench dashboard={dashboard} initial={overview} initialThread={thread} userName={session.userName} />;
}
