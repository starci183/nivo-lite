import { KnowledgeGapsCard } from "@/features/brain/gaps";
import { listGaps } from "@/lib/brain/gaps";
import { agentLenses } from "@/lib/brain/lenses";
import { isManagerRole } from "@/lib/members-shared";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadChatbotOverview, loadChatbotThread } from "@/lib/workbench-chatbot";
import { ChatbotWorkbench } from "./workbench";

/**
 * Chatbot workbench (customer conversations): server component that loads the inbox and the first thread,
 * then hands over to the realtime client. Rendered by the module workbench switch for module "chatbot".
 * Owners and managers also get the questions customers asked that the brain could not answer (knowledge gaps), to fill them in place.
 */
export default async function ChatbotWorkbenchPage(_props: Record<string, unknown>) {
  const [session, overview] = await Promise.all([getSession(), loadChatbotOverview()]);
  const first = overview.conversations[0] ?? null;
  const canFill = isManagerRole(session.member.role);
  const db = supabaseAdmin();
  const [thread, gaps, lenses] = await Promise.all([
    first ? loadChatbotThread(first.id) : Promise.resolve(null),
    canFill ? listGaps(db, session.workspace.id) : Promise.resolve([]),
    canFill ? agentLenses(db, session.workspace.id) : Promise.resolve([]),
  ]);
  return (
    <ChatbotWorkbench
      initial={overview}
      initialThread={thread}
      userName={session.userName}
      gapsCard={canFill ? <KnowledgeGapsCard gaps={gaps} lenses={lenses} business={session.workspace.name} /> : null}
    />
  );
}
