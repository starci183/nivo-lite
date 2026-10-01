import "server-only";
import { serverConfig } from "./config";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/core";
import type { Authority } from "./flow-types";
import { blockedBy, exceededMessage, QuotaExceededError, recordUsage, usageScope, DEFAULT_FALLBACK_REPLY, type ProviderUsage, type UsageKind, type UsageModule } from "./usage";

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

const isOpenRouter = (baseUrl: string) => baseUrl.includes("openrouter.ai");

export type CallMeta = { readonly kind: UsageKind; readonly module: UsageModule };
const CHAT_REPLY: CallMeta = { kind: "chat_reply", module: "chatbot" };
const OWNER_CHAT: CallMeta = { kind: "owner_chat", module: "office" };
const SETUP: CallMeta = { kind: "setup", module: "setup" };
const SALES: CallMeta = { kind: "engine", module: "sales" };
const ACCOUNTING: CallMeta = { kind: "engine", module: "accounting" };

/**
 * The one integration point with the product's model provider (DeepSeek directly or via OpenRouter, OpenAI-compatible).
 * Metered: when the request runs inside a usage scope (`withUsage`), the call is refused with a QuotaExceededError once the
 * workspace is over its plan allowance, and its tokens and cost are recorded afterwards. The scope may override the call's kind.
 */
export const completeRaw = async (messages: ChatMessage[], o: { json?: boolean; temperature?: number; meta: CallMeta }): Promise<string> => {
  const { deepseekApiKey, deepseekModel, deepseekBaseUrl } = serverConfig();
  const scope = usageScope();
  const kind = scope?.kind ?? o.meta.kind;
  const module = scope?.module ?? o.meta.module;
  if (scope) {
    const blocked = await blockedBy(scope.workspaceId, kind);
    if (blocked) throw new QuotaExceededError(exceededMessage(await safeLocale()), blocked);
  }
  const res = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekApiKey}`, "X-Title": "NIVO OS" },
    body: JSON.stringify({
      model: deepseekModel,
      messages,
      temperature: o.temperature ?? 0.4,
      ...(o.json ? { response_format: { type: "json_object" } } : {}),
      // OpenRouter's DeepSeek V4 models think by default; the product wants fast chat replies, not visible reasoning.
      // `usage.include` makes OpenRouter return the exact cost with the token counts.
      ...(isOpenRouter(deepseekBaseUrl) ? { reasoning: { enabled: false }, usage: { include: true } } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    // The provider's raw error goes to the server log only; the reader gets a plain sentence in their language.
    console.error(`model provider ${res.status}: ${(await res.text()).slice(0, 300)}`);
    throw new Error((await safeLocale()) === "vi" ? "AI đang tạm thời không phản hồi. Bạn thử lại sau ít phút nhé." : "The AI is temporarily unavailable. Please try again in a few minutes.");
  }
  const body = (await res.json()) as { choices: { message: { content: string } }[]; usage?: ProviderUsage; model?: string };
  const content = body.choices[0]?.message.content?.trim() ?? "";
  if (scope) {
    await recordUsage({
      workspaceId: scope.workspaceId, kind, module, model: body.model || deepseekModel, usage: body.usage,
      promptChars: messages.reduce((n, m) => n + m.content.length, 0), completionChars: content.length,
    });
  }
  return content;
};

const complete = (messages: ChatMessage[], json = false, meta: CallMeta = OWNER_CHAT): Promise<string> => completeRaw(messages, { json, meta });

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
};

/** Customer-facing chatbot turn: a reply, a lead when the customer has shared enough, and whether a human must confirm. */
export const customerChat = async (agent: AgentInput, turns: ChatTurn[], brief = ""): Promise<CustomerChatOut> => {
  try {
    return await customerChatModel(agent, turns, brief);
  } catch (e) {
    if (!(e instanceof QuotaExceededError)) throw e;
    // Over the plan allowance: no model call. The customer gets a polite acknowledgement and the question is handed to people
    // (needs_human opens a waiting item for the team; the owner already got the Office notice).
    return { reply: e.status.fallbackReply ?? DEFAULT_FALLBACK_REPLY, lead: null, needs_human: true, reason: "unclear_outcome", proposed_answer: null, order: null, payment_claim: false };
  }
};

const customerChatModel = async (agent: AgentInput, turns: ChatTurn[], brief: string): Promise<CustomerChatOut> => {
  const out = await completeJson<Partial<CustomerChatOut>>([
    {
      role: "system",
      content: `${NIVO} ${persona(agent, brief)}
You are talking to a CUSTOMER on the company's chat (website or Telegram). Reply in the customer's language, max 80 words.
When the customer has shared their need AND their name (company, phone or email if possible), set "lead" (otherwise null).
If the customer asks for a price, discount, deadline or any commitment that is not clearly allowed by the business knowledge and authority, or you are not sure of the answer:
set "needs_human": true, "reason": "over_authority" (commitment or price) or "unclear_outcome" (unsure), put in "proposed_answer" ONLY facts found in the business knowledge (never invent a discount, gift, price or policy; if the knowledge has no answer set "proposed_answer": null), written as the FINAL message to the customer, as if the owner has already approved it (warm, concrete, no mention of approval, owner or internal checks), and make "reply" answer what you are allowed to (e.g. list prices) and say politely that the team will confirm the rest shortly: in "reply" never state the discount, gift or commitment itself.
Asking to be contacted, called back or advised, sharing a need or contact details, and general questions answered by the business knowledge are ROUTINE: capture the lead and answer yourself with "needs_human": false.
Otherwise "needs_human": false, "reason": null, "proposed_answer": null.
ORDER: judge ONLY the customer's latest message (an order already placed earlier in the conversation is not a new order). When that message clearly commits to buy (e.g. "mình lấy gói ...", "chốt gói ...", "đặt gói ...") an item whose price is WRITTEN in the business knowledge, set "order": {"items": the item name as written in the knowledge (with quantity if more than one), "amount_vnd": the total price in VND as an integer, copied from the knowledge (never computed from guesses, never invented)}. Also set "lead" when name and contact are known. In "reply" thank them, repeat the item and price, and say the payment details follow in the next message; do not say it is paid. A question, a comparison or "maybe" is NOT an order. If the item or its price is not in the knowledge: "order": null, "needs_human": true, "reason": "over_authority". Otherwise "order": null.
PAYMENT CLAIM: when the customer says they have already paid or transferred the money (e.g. "mình chuyển khoản rồi", "đã CK", a transfer screenshot or receipt text), set "payment_claim": true, "needs_human": false, and in "reply" thank them and say politely that the shop will check the transfer and confirm shortly. Never say the payment is received or confirmed. Otherwise "payment_claim": false.
Reply as JSON {"reply": string, "lead": null | {"contact_name","company","need","phone","email"}, "needs_human": boolean, "reason": "over_authority"|"unclear_outcome"|null, "proposed_answer": string|null, "order": null | {"items": string, "amount_vnd": integer}, "payment_claim": boolean}.`,
    },
    ...toMessages(turns),
  ], CHAT_REPLY);
  return {
    reply: out.reply ?? "",
    lead: out.lead && out.lead.contact_name && out.lead.need ? out.lead : null,
    needs_human: out.needs_human === true,
    reason: out.reason === "over_authority" || out.reason === "unclear_outcome" ? out.reason : out.needs_human ? "unclear_outcome" : null,
    proposed_answer: out.proposed_answer ?? null,
    order: validOrder(out.order),
    payment_claim: out.payment_claim === true,
  };
};

/** An order the model returned, only when it names an item and a positive whole VND amount. */
const validOrder = (o: unknown): CustomerChatOut["order"] => {
  if (!o || typeof o !== "object") return null;
  const { items, amount_vnd } = o as { items?: unknown; amount_vnd?: unknown };
  const amount = typeof amount_vnd === "number" ? amount_vnd : typeof amount_vnd === "string" ? Number(amount_vnd.replace(/[^\d]/g, "")) : NaN;
  if (typeof items !== "string" || !items.trim() || !Number.isFinite(amount) || amount <= 0) return null;
  return { items: items.trim(), amount_vnd: Math.round(amount) };
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
