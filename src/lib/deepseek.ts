import "server-only";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/core";
import type { Authority } from "./flow-types";
import { generateText } from "./openclaw-generate";
import { usageScope, type UsageKind, type UsageModule } from "./usage";

/**
 * DEPRECATED AS A MODEL CLIENT: OpenClaw is the ONLY text-generating AI in NIVO. This file no longer talks to any model provider.
 * Its prompt builders (summarizeContext, classifyLead, draftFollowUp, parseAuthorityChat, ...) keep their names and shapes so callers do not change,
 * but every call is now an engine job `openclaw.generate` through `generateWithOpenClaw` (src/lib/openclaw-generate.ts). New code should call
 * `generateWithOpenClaw` directly. The old direct entry point `completeRaw` is kept only to throw, so nothing can silently bypass OpenClaw.
 * Every call must run inside a usage scope (`withUsage({ workspaceId }, ...)`): the scope names the workspace the job belongs to.
 * Embeddings are not text generation and stay on the embedding API (knowledge/embed.ts).
 */

/** The reader's locale; falls back to Vietnamese where no request is available (background work after the response). */
const safeLocale = async (): Promise<Locale> => {
  try {
    return await getLocale();
  } catch {
    return "vi";
  }
};

const langFor = (locale: Locale) => (locale === "vi" ? " Write in Vietnamese (natural business Vietnamese)." : " Write in English.");

/** Language instruction for AI-prepared interface content, following the reader's VI | EN switch. */
const langRule = async () => langFor(await safeLocale());

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CallMeta = { readonly kind: UsageKind; readonly module: UsageModule };
const CHAT_REPLY: CallMeta = { kind: "chat_reply", module: "chatbot" };
const OWNER_CHAT: CallMeta = { kind: "owner_chat", module: "office" };
const SETUP: CallMeta = { kind: "setup", module: "setup" };
const SALES: CallMeta = { kind: "engine", module: "sales" };
const ACCOUNTING: CallMeta = { kind: "engine", module: "accounting" };
void CHAT_REPLY;

/** REMOVED: a direct model call. Use generateWithOpenClaw (src/lib/openclaw-generate.ts). */
export const completeRaw = async (_messages: ChatMessage[], _o?: { json?: boolean; temperature?: number; meta?: CallMeta }): Promise<string> => {
  throw new Error("completeRaw is removed: OpenClaw is the only text AI. Use generateWithOpenClaw from src/lib/openclaw-generate.ts.");
};

/** Every prompt builder below goes through here: one OpenClaw job in the workspace of the current usage scope. */
const complete = (messages: ChatMessage[], json = false, meta: CallMeta = OWNER_CHAT): Promise<string> => {
  const scope = usageScope();
  if (!scope) return Promise.reject(new Error("AI call outside a usage scope: wrap it in withUsage({ workspaceId }, ...)"));
  return generateText({ workspaceId: scope.workspaceId, purpose: `${meta.module}:${meta.kind}`, messages, responseFormat: json ? "json" : "text", kind: scope.kind ?? meta.kind, module: scope.module ?? meta.module });
};

/** JSON completion; tolerates a fenced code block around the JSON. */
/** Parse a model answer as JSON: bare, fenced, or the first {...} block inside prose. */
const parseJsonLoose = <T>(raw: string): T | null => {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(text) as T; } catch { /* try the embedded object */ }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) as T; } catch { /* fall through */ }
  }
  return null;
};

const completeJson = async <T>(messages: ChatMessage[], meta: CallMeta = OWNER_CHAT): Promise<T> => {
  // Some providers occasionally ignore response_format and answer in prose: parse loosely, then ask once more.
  const first = parseJsonLoose<T>(await complete(messages, true, meta));
  if (first !== null) return first;
  const again = parseJsonLoose<T>(await complete([...messages, { role: "system", content: "Answer again with ONLY the JSON object described above. No prose, no code fences." }], true, meta));
  if (again !== null) return again;
  throw new Error("model did not return JSON");
};

const NIVO =
  "You work inside NIVO OS, a responsibility operating system for founder-led service SMEs in Vietnam. " +
  "Every piece of work has one accountable owner, one explicit next action, and evidence of its outcome. " +
  "Act within the authority the owner granted; ask when data is missing, the action is over the limit, or the outcome is unclear. " +
  "Be concise, concrete and professional.";

/** The owner's granted authority as a prompt section (policies, reply style, brand voice, limits). Empty when nothing is set. */
export const authorityBrief = (a: Authority | null | undefined): string => {
  if (!a) return "";
  const lines = [
    a.policies.trim() && `Business policies:\n${a.policies.trim()}`,
    a.reply_style.trim() && `Reply style: ${a.reply_style.trim()}`,
    a.brand_voice.trim() && `Brand voice: ${a.brand_voice.trim()}`,
    a.limits_note.trim() && `Always ask the owner first when: ${a.limits_note.trim()}`,
  ].filter(Boolean);
  return lines.length ? `\nAuthority granted by the owner:\n${lines.join("\n")}` : "";
};

export type LeadInput = { contact_name: string; company: string; channel: string; need: string };
export type AgentInput = { name: string; handle: string; role: string; instructions: string; knowledge?: string; approval_rule?: string };

export const summarizeContext = async (lead: LeadInput, history: string[]) =>
  complete([
    { role: "system", content: `${NIVO} Write a customer context brief: 3-5 short bullet points starting with "- " (who, need, urgency, risks, what we know). Label the urgency line "Urgency:" / "Mức độ gấp:" and the risk line "Risk:" / "Rủi ro:". No preamble.${await langRule()}` },
    { role: "user", content: `Lead: ${JSON.stringify(lead)}\nHistory:\n${history.join("\n") || "(none)"}` },
  ], false, SALES);

export const proposeResponsibility = async (lead: LeadInput, context: string, agents: AgentInput[], humanName: string) =>
  completeJson<{ title: string; owner_kind: "human" | "agent"; owner_handle: string | null; next_action: string; due_in_days: number; rationale: string }>([
    {
      role: "system",
      content: `${NIVO} Propose ONE responsibility for this lead. Choose the owner: an agent (by handle) when the work is routine follow-up, the human "${humanName}" when judgement or a commitment is needed. Reply as JSON {"title","owner_kind":"human"|"agent","owner_handle":string|null,"next_action","due_in_days":number,"rationale"}. The title, next_action and rationale values:${await langRule()}`,
    },
    { role: "user", content: `Lead: ${JSON.stringify(lead)}\nContext:\n${context}\nAgents: ${JSON.stringify(agents.map(({ name, handle, role }) => ({ name, handle, role })))}` },
  ], SALES);

export const draftFollowUp = (lead: LeadInput, context: string, nextAction: string, agent: AgentInput | null, brief = "") =>
  complete([
    {
      role: "system",
      content: `${NIVO} ${agent ? `You are ${agent.name} (${agent.role}). Instructions: ${agent.instructions}` : ""}${brief} Draft the outbound message that performs the next action. Match the lead's channel. Write in Vietnamese unless the lead's need is in English. Max 120 words. Output only the message.`,
    },
    { role: "user", content: `Lead: ${JSON.stringify(lead)}\nContext:\n${context}\nNext action: ${nextAction}` },
  ], false, SALES);

export const agentReply = (agent: AgentInput, transcript: string[], workspaceBrief: string, brief = "") =>
  complete([
    { role: "system", content: `${NIVO} You are ${agent.name} (@${agent.handle}), role: ${agent.role}. Instructions: ${agent.instructions}${brief}\nWorkspace state:\n${workspaceBrief}\nReply in the team group chat, in the language of the last message, max 90 words. If an action is outside the granted authority, say it needs the owner's decision.` },
    { role: "user", content: transcript.join("\n") },
  ]);

const persona = (a: AgentInput, brief = "") =>
  `You are ${a.name} (@${a.handle}), role: ${a.role}.
Instructions: ${a.instructions}
Business knowledge: ${a.knowledge || "(none)"}
Approval rule: ${a.approval_rule || "Commitments need human approval."}${brief}`;

export type ChatTurn = { role: "user" | "agent"; body: string };
const toMessages = (turns: ChatTurn[]): ChatMessage[] =>
  turns.map((t) => ({ role: t.role === "user" ? "user" : "assistant", content: t.body }));

export type CustomerChatOut = {
  reply: string;
  lead: null | { contact_name: string; company: string; need: string; phone?: string | null; email?: string | null };
  /** true when the customer asks for something outside the granted authority (price, discount, commitment) or the answer is unsure */
  needs_human: boolean;
  reason: "over_authority" | "unclear_outcome" | null;
  /** the answer NIVO proposes for the owner to approve (posted to the customer only after approval) */
  proposed_answer: string | null;
  /** the customer clearly committed to buy an item whose price is written in the business knowledge (amount copied from there) */
  order: null | { items: string; amount_vnd: number };
  /** the customer says they have paid / transferred (a claim, never evidence of payment) */
  payment_claim: boolean;
  /** the person applies for an open job through the chat (Hiring module): validated again by registerChatApplication */
  application?: import("./module-hiring-contract").ChatApplication | null;
  /** loyalty module: the customer asks to redeem one reward of the catalogue (src/lib/module-loyalty-chat.ts opens the gated redeem_reward) */
  loyalty?: null | { intent: "redeem"; reward_key: string };
};

/** Owner testing the agent in its setup screen. */
export const testChat = (agent: AgentInput, turns: ChatTurn[], brief = "") =>
  complete([{ role: "system", content: `${NIVO} ${persona(agent, brief)}
The business owner is testing you. Behave exactly as you would with a customer. Max 80 words.` }, ...toMessages(turns)]);

export const designModule = async (description: string) =>
  completeJson<{ name: string; handle: string; role: string; instructions: string }>([
    { role: "system", content: `${NIVO} Turn the owner's description into an AI module (agent) definition. JSON {"name","handle" (lowercase, a-z0-9-, max 16),"role" (max 6 words),"instructions" (4-6 imperative sentences, include what needs human approval)}. The name, role and instructions values:${await langRule()}` },
    { role: "user", content: description },
  ], SETUP);

/* ------------------------------------------------------------------ operating flow (engine steps; locale passed explicitly) */

export type Classification = { stage: "new" | "qualified" | "proposal" | "won" | "lost"; confidence: number; next_action: string; missing: string[]; context: string };

/** Sales AI: classify a lead with a confidence score, the next step, what is missing, and a short context brief (one call). */
export const classifyLead = async (lead: LeadInput, history: string[], brief: string, locale: Locale): Promise<Classification> => {
  const out = await completeJson<Partial<Classification>>([
    {
      role: "system",
      content: `${NIVO}${brief}
You are the Sales AI. Classify this lead. JSON {"stage":"new"|"qualified"|"proposal"|"won"|"lost","confidence":number 0..1,"next_action":string (one concrete step, max 14 words),"missing":string[] (information still missing, short),"context":string (3-4 short bullet points starting with "- ": who, need, urgency, risk)}.
Use "qualified" when the need is clear and fits; "new" when too little is known yet.
"confidence" is how sure you are that the STAGE you chose is right — not how likely the deal is. A real enquiry with a stated need is "new" or "qualified" with confidence 0.7 or higher, even if details are missing (list those in "missing").
Use a confidence below 0.6 only when you cannot tell what the message is (spam, unrelated, contradictory, no identifiable need). The next_action, missing and context values:${langFor(locale)}`,
    },
    { role: "user", content: `Lead: ${JSON.stringify(lead)}\nHistory:\n${history.join("\n") || "(none)"}` },
  ], SALES);
  const stages = ["new", "qualified", "proposal", "won", "lost"] as const;
  return {
    stage: stages.includes(out.stage as (typeof stages)[number]) ? (out.stage as Classification["stage"]) : "new",
    confidence: typeof out.confidence === "number" ? Math.max(0, Math.min(1, out.confidence)) : 0.5,
    next_action: out.next_action ?? "",
    missing: Array.isArray(out.missing) ? out.missing.map(String) : [],
    context: out.context ?? "",
  };
};

/** Read an order from free text when the channel gave no structured amount (never guesses a price). */
export const extractOrder = async (text: string, locale: Locale): Promise<{ items: string; amount_vnd: number | null; confidence: number }> => {
  const out = await completeJson<{ items?: string; amount_vnd?: number | null; confidence?: number }>([
    {
      role: "system",
      content: `${NIVO} Extract the order from the customer's message. JSON {"items": string (what they order, short), "amount_vnd": integer VND or null when no total is stated (never guess a price), "confidence": number 0..1}. "1,5 triệu" = 1500000. The items value:${langFor(locale)}`,
    },
    { role: "user", content: text },
  ], ACCOUNTING);
  const amount = typeof out.amount_vnd === "number" && Number.isFinite(out.amount_vnd) && out.amount_vnd >= 0 ? Math.round(out.amount_vnd) : null;
  return { items: out.items ?? "", amount_vnd: amount, confidence: typeof out.confidence === "number" ? out.confidence : 0.5 };
};

/** Sales AI: a short thank-you / care message after the customer paid, handed to the Chatbot conversation. */
export const draftCare = (lead: LeadInput, paymentNote: string, brief: string, locale: Locale) =>
  complete([
    {
      role: "system",
      content: `${NIVO}${brief} You are the Sales AI. Write a short, warm customer-care message after the customer's payment was received: thank them, confirm what was paid (item, amount, record code), and end with the next step: invite them to book their first session / appointment (e.g. "hẹn lịch buổi đầu") by replying with a convenient day and time. No new commitments or prices. Address the customer the way they referred to themselves in the conversation (e.g. "anh" if they wrote "anh"); if unknown use "anh/chị" — never guess gender. Write as the business itself (never mention NIVO or AI). Plain text for a chat app: no markdown, no asterisks. Max 70 words. Output only the message.${langFor(locale)}`,
    },
    { role: "user", content: `Customer: ${JSON.stringify(lead)}\nPayment: ${paymentNote}` },
  ], false, SALES);

export type AuthorityChange = {
  goals: { revenue_vnd?: number | null; new_customers?: number | null; first_reply_minutes?: number | null; note?: string | null };
  policies_add: string[];
  reply_style: string | null;
  brand_voice: string | null;
  limits_note_add: string | null;
  rules: Array<{ action: string; mode?: "auto" | "ask" | "never" | null; limit_vnd?: number | null }>;
  understood: boolean;
};

/** Read the owner's plain-language grant of authority from a chat message into structured changes. */
export const parseAuthorityChat = async (text: string, currentRules: string): Promise<AuthorityChange> => {
  const out = await completeJson<Partial<AuthorityChange>>([
    {
      role: "system",
      content: `${NIVO} The business owner tells NIVO in chat what authority to grant. Extract ONLY what the owner said. JSON {
"goals": {"revenue_vnd": integer|null, "new_customers": integer|null, "first_reply_minutes": integer|null, "note": string|null} (null for anything not mentioned; "300 triệu" = 300000000),
"policies_add": string[] (new business rules stated, short sentences, in the owner's language),
"reply_style": string|null, "brand_voice": string|null,
"limits_note_add": string|null (plain "always ask me when ..." statements, in the owner's language),
"rules": [{"action": one of reply_customer|handoff_lead|classify_lead|send_follow_up|send_quote|confirm_order|send_care|issue_invoice|reconcile_payment, "mode": "auto"|"ask"|"never"|null (null = unchanged), "limit_vnd": integer|null (auto strictly BELOW this amount; the amount itself and above ask; null = unchanged)}],
"understood": boolean (false when the message grants or changes nothing)}.
"tự gửi / tự làm / cứ làm" = auto; "hỏi tôi trước" = ask; "không được / không bao giờ" = never. "đơn trên 20 triệu thì hỏi tôi" = confirm_order with limit_vnd 20000000 and mode null. "hóa đơn" = issue_invoice, "đối soát / thanh toán" = reconcile_payment, "follow-up / theo dõi" = send_follow_up, "báo giá" = send_quote.
Current rules: ${currentRules}`,
    },
    { role: "user", content: text },
  ]);
  return {
    goals: out.goals ?? {},
    policies_add: Array.isArray(out.policies_add) ? out.policies_add.map(String).filter(Boolean) : [],
    reply_style: out.reply_style ?? null,
    brand_voice: out.brand_voice ?? null,
    limits_note_add: out.limits_note_add ?? null,
    rules: Array.isArray(out.rules) ? out.rules : [],
    understood: out.understood !== false,
  };
};
