import { KnowledgeGapsCard } from "@/features/brain/gaps";
import { listGaps } from "@/lib/brain/gaps";
import { agentLenses } from "@/lib/brain/lenses";
import { isManagerRole } from "@/lib/members-shared";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import type { Installation } from "@/lib/modules-shared";
import { loadChatbotOverview, loadChatbotThread } from "@/lib/workbench-chatbot";
import { ChatbotWorkbench } from "./workbench";

type ChatbotWorkbenchPageProps = {
  /** `?focus=` of the route: the conversation a "Chờ bạn" row leads to. */
  readonly focus?: string | null;
  /** The Chatbot instance (one per branch or Fanpage): only its conversations, decisions and figures. */
  readonly installation?: Installation | null;
};

/**
 * Chatbot workbench (customer conversations): server component that loads the inbox, the agent dashboard regions and the open thread,
 * then hands over to the realtime client. Rendered by the module workbench switch for module "chatbot".
 * A "Chờ bạn" row opens the conversation it asks about (`?focus=<conversation id>`), else the newest conversation opens.
 * Owners and managers also get the questions customers asked that the brain could not answer (knowledge gaps), to fill them in place:
 * the card replaces the frame's own "Tri thức" gaps block, so the gaps show once, with their actions.
 */
export default async function ChatbotWorkbenchPage({ focus = null, installation = null }: ChatbotWorkbenchPageProps = {}) {
  const installationId = installation?.id ?? null;
  const [session, overview, dashboard] = await Promise.all([
    getSession(),
    loadChatbotOverview(installationId),
    loadAgentDashboard("chatbot", {
      installationId,
      decisionHref: (item) => {
        const conversation = item.proposal.fields?.conversation_id;
        return workbenchHref("chatbot", { installationId, focus: typeof conversation === "string" ? conversation : (item.subject_id ?? undefined) });
      },
    }),
  ]);
  const first = overview.conversations.find((c) => c.id === focus) ?? overview.conversations[0] ?? null;
  const canFill = isManagerRole(session.member.role);
  const db = supabaseAdmin();
  const [thread, gaps, lenses] = await Promise.all([
    first ? loadChatbotThread(first.id) : Promise.resolve(null),
    canFill ? listGaps(db, session.workspace.id) : Promise.resolve([]),
    canFill ? agentLenses(db, session.workspace.id) : Promise.resolve([]),
  ]);
  return (
    <ChatbotWorkbench
      dashboard={dashboard}
      initial={overview}
      initialThread={thread}
      userName={session.userName}
      gapsCard={canFill ? <KnowledgeGapsCard gaps={gaps} lenses={lenses} business={session.workspace.name} /> : null}
    />
  );
}
