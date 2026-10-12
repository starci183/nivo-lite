import "server-only";
import { translator } from "@/i18n/core";
import { office } from "@/i18n/dict/office";
import { acceptsOf, isModuleKey, moduleName, type ModuleKey } from "./module-registry";
import { generateText } from "./openclaw-generate";
import { withUsage } from "./usage";
import { logEvidence } from "./core";
import type { EngineCtx } from "./engine";
import {
  acceptsText, matchLeads, matchOrders, readCommandChoice, resolveCandidate,
  type AcceptedCommand, type CandidateRow, type CommandCandidate, type LeadRef, type OrderRef,
} from "./office-command-rules";
import type { Agent, Message } from "./types";

/**
 * Office "@agent -> command". An owner or manager mentions ONE agent; NIVO reads the message into a command candidate with ONE metered model
 * call (usage kind "office_command"), shows it as a confirm card, and only a click sends it (agent-commands.ts sendCommand, from "owner", so the
 * receiver's own gate still decides). The model never talks to another agent: it picks from the receiver's declared `accepts` and fills what
 * the contract requires from the message plus the customer / order the message names. When nothing maps, NIVO answers with the list of what
 * that agent accepts and stops: no second call, no loop.
 */

export type { CandidateRow, CommandCandidate };

/** The modules' accepted commands in the shape the pure rules read. */
export const acceptedOf = (module: ModuleKey): Array<AcceptedCommand> =>
  acceptsOf(module).map((a) => ({ command: a.command, subjectType: a.subjectType, requiredFields: a.requiredFields, description: { vi: a.description.vi, en: a.description.en } }));

const REF_POOL = 300;
const MAX_REFS = 5;

/** Names and numbers the message could mean: matched deterministically against the workspace's recent customers and orders. */
const referencesIn = async (c: EngineCtx, body: string): Promise<{ leads: Array<LeadRef>; orders: Array<OrderRef>; leadNames: Map<string, string> }> => {
  const [leadRows, orderRows] = await Promise.all([
    c.db.from("leads").select("id, contact_name, company").eq("workspace_id", c.ws).order("created_at", { ascending: false }).limit(REF_POOL),
    c.db.from("orders").select("id, order_no, lead_id").eq("workspace_id", c.ws).order("created_at", { ascending: false }).limit(REF_POOL),
  ]);
  const allLeads = ((leadRows.data ?? []) as Array<{ id: string; contact_name: string; company: string | null }>).map((l) => ({ id: l.id, name: l.contact_name, company: l.company }));
  const allOrders = ((orderRows.data ?? []) as Array<{ id: string; order_no: string; lead_id: string | null }>).map((o) => ({ id: o.id, orderNo: o.order_no, leadId: o.lead_id }));
  const orders = matchOrders(body, allOrders).slice(0, MAX_REFS);
  const leads = matchLeads(body, allLeads).slice(0, MAX_REFS);
  return { leads, orders, leadNames: new Map(allLeads.map((l) => [l.id, l.name])) };
};

const promptFor = (agentName: string, accepts: ReadonlyArray<AcceptedCommand>, text: string, refs: { leads: ReadonlyArray<LeadRef>; orders: ReadonlyArray<OrderRef> }) =>
  [
    {
      role: "system" as const,
      content: `You turn ONE message from a business owner into at most ONE command for the agent "${agentName}". Pick ONLY from this list (command key, what it does, the keys it needs):
${accepts.map((a) => `- ${a.command}: ${a.description.en} / ${a.description.vi}; subject=${a.subjectType}; needs ${a.requiredFields.join(", ") || "nothing"}`).join("\n")}
References the message names (the ONLY ids you may use):
customers: ${JSON.stringify(refs.leads.map((l) => ({ id: l.id, name: l.name })))}
orders: ${JSON.stringify(refs.orders.map((o) => ({ id: o.id, order_no: o.orderNo, lead_id: o.leadId })))}
Return ONLY JSON {"intent": "command"|"question", "command": string|null, "subject_id": string|null, "lead_id": string|null, "fields": {"<key>": string|number}}.
"intent" is "question" when the owner asks something, reports something or makes small talk rather than telling the agent to DO a task; then "command" is null. "command" is also null when the owner asks for a task the agent does not accept. Never invent an id: use null when the reference is not in the lists above. "fields" holds ONLY the needed keys other than subject_id and lead_id, taken from the message.`,
    },
    { role: "user" as const, content: text },
  ];

/** The line the card shows ("xuất phiếu thu cho đơn #DH-1"). */
const summaryOf = (locale: "vi" | "en", what: string, rows: ReadonlyArray<CandidateRow>): string => {
  const subject = rows.find((r) => r.key === "order") ?? rows.find((r) => r.key === "customer");
  return subject ? `${what} ${locale === "vi" ? "cho" : "for"} ${subject.value}` : what;
};

type ProposeInput = { readonly message: Message; readonly agent: Agent; readonly body: string; readonly author: string };

/**
 * Turns the manager's message into a candidate, or into a NIVO reply. Returns the NIVO messages to show (empty when a card was created, since
 * the card is the answer), or null when this agent accepts no commands at all or the message is a question (the caller then chats as before).
 */
export const proposeOfficeCommand = async (c: EngineCtx, i: ProposeInput): Promise<Array<Message> | null> => {
  if (!isModuleKey(i.agent.module)) return null;
  const module: ModuleKey = i.agent.module;
  const accepts = acceptedOf(module);
  if (accepts.length === 0) return null;
  const locale: "vi" | "en" = c.locale === "en" ? "en" : "vi";
  const t = translator(office, c.locale) as (k: string, v?: Record<string, string | number>) => string;
  const names = { handle: i.agent.handle, agent: moduleName(module, c.locale), list: acceptsText(locale, accepts) };
  const nivo = async (body: string): Promise<Array<Message>> => {
    const { data } = await c.db.from("messages").insert({ workspace_id: c.ws, author_kind: "system", author_name: "NIVO", body }).select().single();
    return data ? [data as Message] : [];
  };

  const refs = await referencesIn(c, i.body);
  let raw: string;
  try {
    // The ONE model call of this feature; it is metered under its own kind and nothing else is called after it.
    raw = await withUsage({ workspaceId: c.ws, kind: "office_command", module: "office" }, () =>
      generateText({ workspaceId: c.ws, purpose: "office:office_command", messages: promptFor(names.agent, accepts, i.body, refs), responseFormat: "json", kind: "office_command", module: "office" }),
    );
  } catch (e) {
    return nivo(t("cmdReadFailed", { ...names, error: e instanceof Error ? e.message : String(e) }));
  }

  const choice = readCommandChoice(raw);
  // A question is not a command: the caller answers it as the agent chat did before (owner ruling 2026-10-12).
  if (choice?.intent === "question") return null;
  const res = resolveCandidate(choice, accepts, refs);
  if (res.kind === "unmapped") return nivo(t("cmdUnmapped", names));
  if (res.kind === "missing") {
    const need = res.missing.map((k) => (k === "subject_id" ? needOf(t, res.accepted.subjectType) : k === "lead_id" ? t("cmdNeedLead") : t("cmdNeedOther", { field: k }))).join(", ");
    return nivo(t("cmdMissing", { ...names, what: res.accepted.description[locale], missing: need }));
  }

  const rows: Array<CandidateRow> = [];
  if (res.leadId) rows.push({ key: "customer", label: t("cmdFieldCustomer"), value: refs.leadNames.get(res.leadId) ?? refs.leads.find((l) => l.id === res.leadId)?.name ?? res.leadId });
  const order = res.orderId ? refs.orders.find((o) => o.id === res.orderId) : undefined;
  if (order) rows.push({ key: "order", label: t("cmdFieldOrder"), value: order.orderNo.startsWith("#") ? order.orderNo : `#${order.orderNo}` });
  for (const [key, value] of Object.entries(res.extra)) rows.push({ key, label: key, value: String(value) });

  const { error } = await c.db.from("office_command_candidates").insert({
    workspace_id: c.ws, message_id: i.message.id, module, command: res.accepted.command, payload: res.payload,
    summary: summaryOf(locale, res.accepted.description[locale], rows), shown: rows, created_by: i.author,
  });
  if (error) throw new Error(error.message);
  await logEvidence(c.db, c.ws, { kind: "command.candidate", actor: i.author, summary: `owner → ${module}.${res.accepted.command}`, evidence: i.message.id }).catch(() => {});
  return [];
};

const needOf = (t: (k: string, v?: Record<string, string | number>) => string, subjectType: string): string =>
  subjectType === "order" ? t("cmdNeedOrder") : subjectType === "lead" ? t("cmdNeedLead") : subjectType === "invoice" ? t("cmdNeedInvoice") : t("cmdNeedOther", { field: subjectType });

type Db = EngineCtx["db"];
/** The latest candidates of the workspace (the Office thread places each under its message). Empty for staff (RLS) and before the migration. */
export const listCommandCandidates = async (db: Db, limit = 60): Promise<Array<CommandCandidate>> => {
  const { data } = await db.from("office_command_candidates").select("id, message_id, module, command, payload, summary, shown, status, work_item_id, refusal_detail, created_at").order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as Array<CommandCandidate>).filter((r) => isModuleKey(r.module));
};
