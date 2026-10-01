import { getSession } from "@/lib/session";
import { loadChatbotOverview, loadChatbotThread } from "@/lib/workbench-chatbot";
import { ChatbotWorkbench } from "./workbench";

/**
 * Chatbot workbench (customer conversations): server component that loads the inbox and the first thread,
 * then hands over to the realtime client. Rendered by the module workbench switch for module "chatbot".
 */
export default async function ChatbotWorkbenchPage(_props: Record<string, unknown>) {
  const [session, overview] = await Promise.all([getSession(), loadChatbotOverview()]);
  const first = overview.conversations[0] ?? null;
  const thread = first ? await loadChatbotThread(first.id) : null;
  return <ChatbotWorkbench initial={overview} initialThread={thread} userName={session.userName} />;
}
