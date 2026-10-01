import "server-only";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import * as ai from "./deepseek";
import { QuotaExceededError, withUsage } from "./usage";
import { logEvidence } from "./core";
import { loadAuthority, resumeWork, type EngineCtx } from "./engine";
import { staffHandles } from "./staff-handle";
import type { Role } from "./members-shared";
import type { Staff, WorkItem } from "./flow-types";
import type { Agent, AgentMessage, Message } from "./types";

/**
 * Office is one group chat of people and AI. The customer only ever talks to the Chatbot; when the Chatbot cannot answer
 * alone, it tags a staff member in Office (escalateToStaff), the staff member answers in Office, and the Chatbot turns that
 * answer into its own reply and sends it on the customer's channel through the normal decision path (relayStaffAnswer).
 */
const T = (c: EngineCtx) => translator(system, c.locale);

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (hay: string, needle: string) => needle.length >= 2 && new RegExp(`(?:^|[^a-z0-9])${esc(needle)}(?:$|[^a-z0-9])`).test(hay);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const HONORIFIC = /^(anh|chi|em|co|chu|ong|ba|bac|di|thay|mr|mrs|ms)\s+/;

/** Roles that answer customers first ("Tư vấn viên", "Sales", "Bán hàng", "CSKH"). */
const ADVISOR_ROLE = /tu van|sales|ban hang|kinh doanh|cskh|cham soc khach|advis|consult/;

/** Active staff, oldest first: the order every screen uses to derive @handles. */
export const activeStaff = async (c: EngineCtx): Promise<Array<Staff>> =>
  ((await c.db.from("staff").select("*").eq("workspace_id", c.ws).eq("active", true).order("created_at")).data ?? []) as Array<Staff>;

/** id → @handle of the active staff, clear of every agent handle and @nivo. */
export const officeStaffHandles = async (c: EngineCtx, staff: ReadonlyArray<Staff>): Promise<Map<string, string>> => {
  const agents = ((await c.db.from("agents").select("handle").eq("workspace_id", c.ws)).data ?? []) as Array<{ handle: string }>;
  return staffHandles(staff, agents.map((a) => a.handle));
};

/** The workspace's customer-facing Chatbot (oldest active one), or null when none is installed. */
const chatbotOf = async (c: EngineCtx): Promise<Agent | null> =>
  (((await c.db.from("agents").select("*").eq("workspace_id", c.ws).eq("module", "chatbot").eq("status", "active").order("created_at").limit(1)).data ?? [])[0] ?? null) as Agent | null;

/** A line in Office written by the Chatbot (NIVO when no Chatbot is installed), linked to the work item. */
const postAsChatbot = async (c: EngineCtx, bot: Agent | null, body: string, link: { lead_id: string | null; work_item_id: string | null }): Promise<Message> => {
  const { data, error } = await c.db.from("messages").insert({
    workspace_id: c.ws, author_kind: bot ? "agent" : "system", author_name: bot?.name ?? "NIVO", agent_id: bot?.id ?? null, body,
    lead_id: link.lead_id, work_item_id: link.work_item_id,
  }).select().single();
  if (error) throw new Error(error.message);
  return data as Message;
};

/**
 * A person's message in Office, authored by the signed-in member (`staff_id` is their staff row when they have one).
 * `staff_id` needs migration 20260930213000_office_staff_messages; before it is applied the message is still stored
 * (under the staff member's name) without the id.
 */
export const insertHumanMessage = async (c: EngineCtx, m: { author_name: string; staff_id: string | null; body: string }): Promise<Message> => {
  const row: Record<string, unknown> = { workspace_id: c.ws, author_kind: "human", author_name: m.author_name, body: m.body };
  let res = await c.db.from("messages").insert(m.staff_id ? { ...row, staff_id: m.staff_id } : row).select().single();
  if (res.error && m.staff_id && /staff_id/.test(res.error.message)) res = await c.db.from("messages").insert(row).select().single();
  if (res.error) throw new Error(res.error.message);
  return res.data as Message;
};

/** One active staff member of this workspace, or an error the Office shows. */
export const staffMember = async (c: EngineCtx, staffId: string): Promise<Staff> => {
  const { data } = await c.db.from("staff").select("*").eq("id", staffId).eq("workspace_id", c.ws).eq("active", true).maybeSingle();
  if (!data) throw new Error(T(c)("staffNotFoundOrInactive"));
  return data as Staff;
};

export type EscalateArgs = { workItemId: string; conversationId: string; customerName: string; question: string; proposed?: string | null };

/**
 * The Chatbot cannot answer the customer alone (a waiting reply_customer item): give the item to the staff member who
 * advises customers (first active staff whose role mentions tư vấn / sales, else the first active one) and ask them in
 * Office as the Chatbot: "@ha ơi, khách Anh Minh hỏi: “…”. Em nên trả lời sao ạ?".
 * Never throws (the customer's turn must not fail because of it): returns null when nobody could be asked.
 */
export const escalateToStaff = async (c: EngineCtx, args: EscalateArgs): Promise<{ staff: Staff; handle: string; message: Message } | null> => {
  try {
    const staff = await activeStaff(c);
    if (!staff.length) return null;
    const person = staff.find((s) => ADVISOR_ROLE.test(fold(s.role ?? ""))) ?? staff[0];
    const handle = (await officeStaffHandles(c, staff)).get(person.id) ?? "staff";
    const bot = await chatbotOf(c);

    // Same effect as assignWorkItem: the item is theirs, recorded in the evidence log.
    const { data, error } = await c.db.from("work_items").update({ assigned_staff_id: person.id, updated_at: new Date().toISOString() })
      .eq("id", args.workItemId).eq("workspace_id", c.ws).select().single();
    if (error) throw new Error(error.message);
    const item = data as WorkItem;
    await logEvidence(c.db, c.ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "work.assigned", actor: bot?.name ?? c.actor, summary: `→ ${person.name}` });

    const t = T(c);
    const name = args.customerName.trim() || t("staffCustomerUnknown");
    const proposed = args.proposed?.trim();
    const body = t("staffAsk", { handle, name, question: clip(args.question.trim(), 400) }) + (proposed ? t("staffAskDraft", { proposed: clip(proposed, 300) }) : "");
    const message = await postAsChatbot(c, bot, body, { lead_id: item.lead_id, work_item_id: item.id });
    return { staff: person, handle, message };
  } catch (e) {
    console.error("escalateToStaff failed", e instanceof Error ? e.message : e);
    return null;
  }
};

type WaitingReply = WorkItem & { lead: { contact_name: string } | null };

/** Owner words that are decisions, never answers for a customer ("@chatbot đồng ý"). */
const DECISION_WORDS = /^(dong y|duyet|approve|chap nhan|tu choi|khong duyet|reject|decline|ok\b|oke|okay|yes\b|no\b)/;

const customerNameOf = async (c: EngineCtx, w: WaitingReply): Promise<string> => {
  const fromLead = w.lead?.contact_name?.trim();
  if (fromLead) return fromLead;
  const convId = typeof w.proposal?.fields?.conversation_id === "string" ? w.proposal.fields.conversation_id : null;
  if (!convId) return "";
  const { data } = await c.db.from("agent_conversations").select("visitor_name").eq("id", convId).maybeSingle();
  return ((data as { visitor_name: string | null } | null)?.visitor_name ?? "").trim();
};

/** The Chatbot says the staff member's answer to the customer in its own voice (one LLM call). */
const rewriteForCustomer = async (c: EngineCtx, bot: Agent | null, convId: string | null, question: string, answer: string): Promise<string> => {
  const history = convId
    ? (((await c.db.from("agent_messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(10)).data ?? []) as Array<AgentMessage>).reverse()
    : [];
  const turns: Array<ai.ChatTurn> = history.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "user" ? "user" : "agent", body: m.body }));
  if (!turns.length || turns.at(-1)?.role !== "user") turns.push({ role: "user", body: question });
  const agent: ai.AgentInput = bot
    ? { name: bot.name, handle: bot.handle, role: bot.role, instructions: bot.instructions, knowledge: bot.knowledge, approval_rule: bot.approval_rule }
    : { name: "Chatbot", handle: "chatbot", role: "Customer chat", instructions: "Answer customers warmly and briefly." };
  const brief = `${ai.authorityBrief(await loadAuthority(c))}

THE TEAM HAS ANSWERED the customer's last question ("${clip(question, 300)}"). The team's answer: """${clip(answer, 800)}"""
Write your next message to the customer that gives exactly this answer, in your own warm voice and in the customer's language.
Keep every fact, number, price, date and condition exactly as the team wrote it; add no new promise, price or detail.
Never mention colleagues, staff, the owner, approval, internal checks or that you asked someone. Output only the message.`;
  try {
    const reply = await withUsage({ workspaceId: c.ws, kind: "relay", module: "chatbot" }, () => ai.testChat(agent, turns, brief));
    return reply.trim().replace(/^["“]|["”]$/g, "").trim() || answer;
  } catch (e) {
    // Over the plan allowance: no model call; the team's own answer goes to the customer as written.
    if (e instanceof QuotaExceededError) return answer;
    throw e;
  }
};

/**
 * A message in Office may be the answer the Chatbot is waiting for. It is when:
 *  - its author is the signed-in staff member an open reply_customer item is assigned to (matched by member.staffId), or
 *  - it @mentions the Chatbot while an escalated reply_customer item is open and the author is owner or manager (with a
 *    statement that is not a decision or a question to the bot). A staff member never answers an item that is not theirs.
 * Exactly one item must be meant (the only candidate, or the one whose customer the text names); otherwise the Chatbot
 * asks which customer and nothing is sent. The answer is rewritten for the customer (one LLM call) and the item is
 * resolved through the normal decision path with the author as decider: the replyCustomer performer posts it in the
 * conversation and delivers it on the customer's channel. Returns the Chatbot's Office messages, or null when the
 * message is not an answer (the normal Office handling continues).
 */
export const relayStaffAnswer = async (
  c: EngineCtx, input: { text: string; author: { name: string; staffId: string | null; role: Role } },
): Promise<Array<Message> | null> => {
  const bot = await chatbotOf(c);
  const raw = input.text.trim();
  const mentionsBot = !!bot && new RegExp(`@${esc(bot.handle)}(?![a-z0-9-])`, "i").test(raw);
  const isManager = input.author.role !== "staff";
  if (!input.author.staffId && !(isManager && mentionsBot)) return null;

  const waiting = ((await c.db.from("work_items").select("*, lead:leads(contact_name)").eq("workspace_id", c.ws).eq("action", "reply_customer")
    .eq("status", "waiting_decision").order("created_at").limit(50)).data ?? []) as Array<WaitingReply>;
  const escalated = waiting.filter((w) => w.assigned_staff_id);
  const answer = (bot ? raw.replace(new RegExp(`@${esc(bot.handle)}(?![a-z0-9-])[:,]?`, "gi"), " ") : raw).replace(/\s+/g, " ").trim();
  if (answer.length < 2) return null;

  let pool: Array<WaitingReply>;
  if (input.author.staffId) {
    const mine = escalated.filter((w) => w.assigned_staff_id === input.author.staffId);
    pool = mine.length ? mine : isManager && mentionsBot ? escalated : [];
  } else {
    // The owner: only an explicit statement to the bot; decisions and questions keep their normal meaning.
    const f = fold(answer);
    pool = DECISION_WORDS.test(f) || /[?？]\s*$/.test(answer) ? [] : escalated;
  }
  if (!pool.length) return null;

  const t = T(c);
  const names = new Map<string, string>();
  for (const w of pool) names.set(w.id, await customerNameOf(c, w));
  let target: WaitingReply | null = pool.length === 1 ? pool[0] : null;
  if (!target) {
    const f = fold(answer);
    const hits = pool.filter((w) => {
      const full = fold(names.get(w.id) ?? "");
      return !!full && (hasWord(f, full) || hasWord(f, full.replace(HONORIFIC, "")));
    });
    if (hits.length === 1) target = hits[0];
    else {
      const list = pool.slice(0, 6).map((w, i) => `${i + 1}) ${names.get(w.id) || t("staffCustomerUnknown")}: “${clip(String(w.proposal?.fields?.question ?? w.proposal?.summary ?? ""), 80)}”`).join("; ");
      return [await postAsChatbot(c, bot, t("staffRelayWhich", { staff: input.author.name, n: pool.length, list }), { lead_id: null, work_item_id: null })];
    }
  }

  const name = names.get(target.id) || t("staffCustomerUnknown");
  const link = { lead_id: target.lead_id, work_item_id: target.id };
  try {
    const f = target.proposal?.fields ?? {};
    const question = String(f.question ?? target.proposal?.summary ?? "");
    const convId = typeof f.conversation_id === "string" ? f.conversation_id : null;
    const reply = await rewriteForCustomer(c, bot, convId, question, answer);
    await resumeWork(c, target.id, "approved", { draft: reply }, { name: input.author.name, kind: isManager ? "owner" : "staff" },
      t("staffRelayNote", { staff: input.author.name, text: clip(answer, 300) }));
    return [await postAsChatbot(c, bot, t("staffRelaySent", { name, reply }), link)];
  } catch (e) {
    return [await postAsChatbot(c, bot, t("staffRelayFailed", { name, error: e instanceof Error ? e.message : String(e) }), link)];
  }
};
