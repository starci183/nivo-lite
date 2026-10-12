import "server-only";
import { isModuleKey, commandOf, moduleName, type ModuleKey } from "./module-registry";
import { logEvidence } from "./core";
import { postOffice, runWork, type EngineCtx } from "./engine";
import {
  MAX_COMMAND_DEPTH, defaultDedupeKey, missingPayload, mirrorText, splitPayload, subjectPhrase, tooDeep,
} from "./agent-command-rules";
import type { FlowAction, Origin, Proposal, WorkItem } from "./flow-types";

/**
 * The agent command bus. Agents coordinate ONLY by typed commands; a chat mention in the Office is a mirror for humans, never the channel.
 *
 * Why commands, not chat:
 *  - typed: a module declares what it accepts (module.json `accepts`: command, payload keys, subject) and a command that is not in the
 *    contract, or lacks a required key, is refused before anything exists. No free text is ever interpreted by another agent.
 *  - gated per hop: a command becomes the receiver's own work item through runWork, so the RECEIVER's authority rule, limit, operating
 *    mode and approval decide. A sender never lends its authority (Sales approving 45M does not let Accounting invoice 45M).
 *  - idempotent: the dedupe key makes a redelivered or retried command return the first work item and create nothing new.
 *  - traceable: every work item carries chain_id (the root's id) and depth; parent_id says who asked; an event records why.
 *  - cycle-safe: depth > 6 is refused, and so is a second (command, subject) inside one chain, so A -> B -> A loops stop at once.
 *  - credit-safe: no LLM talks to another LLM. The only model call is the receiver's own prepare step, the same one a human trigger would
 *    cause, and a refused command makes none.
 *
 * Office mirror: every accepted command posts one system line ("@Kế toán ← Bán hàng: xuất phiếu thu cho đơn #123") linked to the work
 * item, as a `messages` row (author_kind system, author COMMAND_LINE_AUTHOR). It is written, not generated.
 */

/** "owner" (a person), "inbound" (a customer or channel input), a module key (that department's agent) or an agent id. */
export type CommandSender = string;

export type SendCommandInput = {
  from: CommandSender;
  to: ModuleKey;
  command: string;
  /** Contract keys of the receiver (`accepts.required_fields`). `subject_type`, `subject_id`, `lead_id` address the work item; the rest become proposal fields. */
  payload: Readonly<Record<string, unknown>>;
  chainId?: string | null;
  /** the work item that asked (sets parent_id; the chain and depth follow from it) */
  parentId?: string | null;
  /** why, in one line: kept in the event log, not in the Office */
  reason: string;
  dedupeKey?: string;
  origin?: Origin;
  inboundEventId?: string | null;
  seed?: Partial<Proposal>;
  queue?: boolean;
  preset?: boolean;
  noChain?: boolean;
  forceAsk?: WorkItem["reason"];
};

export type CommandRefusal = "unknown_module" | "unknown_command" | "unknown_sender" | "missing_fields" | "too_deep" | "cycle";
export type CommandResult =
  | { ok: true; item: WorkItem; created: boolean; chainId: string | null; depth: number }
  | { ok: false; refused: CommandRefusal; detail: string; missing?: Array<string> };

type Sender = { label: string; module: ModuleKey | null };

const resolveSender = async (c: EngineCtx, from: CommandSender): Promise<Sender | null> => {
  if (from === "owner") return { label: c.locale === "en" ? "Owner" : "Chủ shop", module: null };
  if (from === "inbound") return { label: c.locale === "en" ? "Customer" : "Khách", module: null };
  if (isModuleKey(from)) return { label: moduleName(from, c.locale), module: from };
  if (!/^[0-9a-f-]{36}$/i.test(from)) return null;
  const agent = ((await c.db.from("agents").select("name, module").eq("workspace_id", c.ws).eq("id", from).maybeSingle()).data ?? null) as { name: string; module: string } | null;
  if (!agent) return null;
  return { label: isModuleKey(agent.module) ? moduleName(agent.module, c.locale) : agent.name, module: isModuleKey(agent.module) ? agent.module : null };
};

/** A readable label of the subject for the Office line (the order number, the customer's name, the invoice number); null when it cannot be read. */
const subjectLabel = async (c: EngineCtx, type: string, id: string | null): Promise<string | null> => {
  if (!id) return null;
  const read = async (table: string, col: string) => {
    const row = ((await c.db.from(table).select(col).eq("id", id).maybeSingle()).data ?? null) as unknown as Record<string, unknown> | null;
    return row && typeof row[col] === "string" ? (row[col] as string) : null;
  };
  try {
    if (type === "order") return await read("orders", "order_no");
    if (type === "lead") return await read("leads", "contact_name");
    if (type === "invoice") return await read("invoices", "invoice_no");
  } catch {
    /* a label is a courtesy: never block a command on it */
  }
  return null;
};

const refuse = async (c: EngineCtx, i: SendCommandInput, refused: CommandRefusal, detail: string, missing?: Array<string>): Promise<CommandResult> => {
  await logEvidence(c.db, c.ws, { kind: "command.refused", actor: "NIVO", summary: `${i.from} → ${i.to}.${i.command}: ${refused}`, evidence: detail }).catch(() => {});
  return { ok: false, refused, detail, ...(missing ? { missing } : {}) };
};

/**
 * Send one command to a module. Validates the contract, the depth and the cycle rule, then creates the receiver's work item through
 * runWork (the receiver's gate decides), mirrors it in the Office, and returns the item. A repeat of the same dedupe key returns the
 * existing item (`created: false`) and posts nothing.
 */
export const sendCommand = async (c: EngineCtx, i: SendCommandInput): Promise<CommandResult> => {
  if (!isModuleKey(i.to)) return refuse(c, i, "unknown_module", `no agent ${i.to}`);
  const accepted = commandOf(i.to, i.command);
  if (!accepted) return refuse(c, i, "unknown_command", `${i.to} does not accept ${i.command}`);
  const sender = await resolveSender(c, i.from);
  if (!sender) return refuse(c, i, "unknown_sender", `no sender ${i.from}`);
  const missing = missingPayload(accepted.requiredFields, i.payload);
  if (missing.length) return refuse(c, i, "missing_fields", `${i.to}.${i.command} needs ${missing.join(", ")}`, missing);

  const { subjectType, subjectId, leadId, fields } = splitPayload(i.payload, accepted.subjectType);
  const locale = c.locale === "en" ? "en" : "vi";

  // Where this command sits in its chain.
  let chainId = i.chainId ?? null;
  let depth = 0;
  if (i.parentId) {
    const parent = ((await c.db.from("work_items").select("id, chain_id, depth").eq("workspace_id", c.ws).eq("id", i.parentId).maybeSingle()).data ?? null) as Pick<WorkItem, "id" | "chain_id" | "depth"> | null;
    if (parent) { depth = (parent.depth ?? 0) + 1; chainId = chainId ?? parent.chain_id ?? parent.id; }
  } else if (chainId) {
    const top = ((await c.db.from("work_items").select("depth").eq("workspace_id", c.ws).eq("chain_id", chainId).order("depth", { ascending: false }).limit(1)).data ?? [])[0] as { depth: number } | undefined;
    depth = top ? top.depth + 1 : 1;
  }
  if (tooDeep(depth)) return refuse(c, i, "too_deep", `depth ${depth} > ${MAX_COMMAND_DEPTH} in chain ${chainId}`);

  const dedupeKey = i.dedupeKey ?? defaultDedupeKey(i.command, subjectType, subjectId);
  if (chainId) {
    // The same command about the same subject twice in one chain is a cycle. A retry of the SAME dedupe key is not (runWork dedupes it below).
    let q = c.db.from("work_items").select("id", { count: "exact", head: true }).eq("workspace_id", c.ws).eq("chain_id", chainId).eq("action", accepted.action).eq("subject_type", subjectType).neq("dedupe_key", dedupeKey);
    q = subjectId ? q.eq("subject_id", subjectId) : q.is("subject_id", null);
    if (((await q).count ?? 0) > 0) return refuse(c, i, "cycle", `${i.command} on ${subjectType}:${subjectId ?? "none"} already ran in chain ${chainId}`);
  }

  let created = false;
  const item = await runWork(c, {
    action: accepted.action as FlowAction, subject_type: subjectType as WorkItem["subject_type"], subject_id: subjectId, lead_id: leadId,
    inbound_event_id: i.inboundEventId ?? null, parent_id: i.parentId ?? null, dedupeKey, origin: i.origin ?? "live",
    seed: { ...(i.seed ?? {}), fields: { ...(i.seed?.fields ?? {}), ...fields } as Proposal["fields"] },
    queue: i.queue, preset: i.preset, noChain: i.noChain, forceAsk: i.forceAsk ?? undefined, chainId, depth,
    onInserted: async (row) => {
      created = true;
      const subject = subjectPhrase(locale, subjectType, await subjectLabel(c, subjectType, subjectId));
      await postOffice(c, {
        command: true, body: mirrorText({ locale, toName: moduleName(i.to, c.locale), fromName: sender.label, what: accepted.description[locale], subject }),
        lead_id: row.lead_id, work_item_id: row.id,
      }).catch(() => {});
      await logEvidence(c.db, c.ws, { lead_id: row.lead_id, work_item_id: row.id, kind: "command.sent", actor: sender.label, summary: `${i.to}.${i.command}`, evidence: i.reason }).catch(() => {});
    },
  });
  return { ok: true, item, created, chainId: item.chain_id, depth: item.depth ?? depth };
};

/** sendCommand for callers that cannot continue without the work item (an entry point such as a lead hand-off): a refusal is a programming error and throws. */
export const sendCommandItem = async (c: EngineCtx, i: SendCommandInput): Promise<WorkItem> => {
  const r = await sendCommand(c, i);
  if (!r.ok) throw new Error(`command ${i.to}.${i.command} refused: ${r.refused} (${r.detail})`);
  return r.item;
};
