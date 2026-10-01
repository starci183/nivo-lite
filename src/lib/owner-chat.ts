import "server-only";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { governance } from "@/i18n/dict/governance";
import { access } from "@/i18n/dict/access";
import * as ai from "./deepseek";
import { logDecision, logEvidence } from "./core";
import { formatVnd, resumeWork, type Decider, type EngineCtx } from "./engine";
import { ACTION_DEPARTMENT } from "./policy";
import type { Authority, AuthorityRule, Department, FlowAction, RuleMode, WorkEdits, WorkItem } from "./flow-types";

/**
 * The owner talks to NIVO in Office: authority granted in plain words ("@nivo …") and decisions typed in chat.
 * Shared by the server actions (flow-actions.ts, actions.ts) and runnable outside a request (context passed in).
 */
const T = (c: EngineCtx) => translator(system, c.locale);
const G = (c: EngineCtx) => translator(governance, c.locale) as (k: string, v?: Record<string, string | number>) => string;

export const ACTIONS = Object.keys(ACTION_DEPARTMENT) as Array<FlowAction>;
export const MODES: Array<RuleMode> = ["auto", "ask", "never"];
const AUTHORITY_KEYS = ["goal_revenue_vnd", "goal_new_customers", "goal_first_reply_minutes", "goal_note", "policies", "reply_style", "brand_voice", "limits_note"] as const;

export const saveAuthorityCore = async (c: EngineCtx, patch: Partial<Record<(typeof AUTHORITY_KEYS)[number], unknown>>): Promise<Authority> => {
  const clean: Record<string, unknown> = {};
  for (const k of AUTHORITY_KEYS) if (k in patch) clean[k] = patch[k];
  const { data, error } = await c.db.from("authority").upsert({ workspace_id: c.ws, ...clean, updated_by: c.actor, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" }).select().single();
  if (error) throw new Error(error.message);
  return data as Authority;
};

export const saveRuleCore = async (
  c: EngineCtx, input: { department: Department; action: FlowAction; mode: RuleMode; limit_vnd: number | null; required_fields?: Array<string>; note?: string },
): Promise<AuthorityRule> => {
  if (!ACTIONS.includes(input.action) || ACTION_DEPARTMENT[input.action] !== input.department || !MODES.includes(input.mode)) throw new Error("Invalid rule");
  if (input.limit_vnd !== null && (!Number.isFinite(input.limit_vnd) || input.limit_vnd < 0)) throw new Error(T(c)("amountInvalid"));
  const { data, error } = await c.db.from("authority_rules").upsert({
    workspace_id: c.ws, department: input.department, action: input.action, mode: input.mode, limit_vnd: input.limit_vnd,
    ...(input.required_fields ? { required_fields: input.required_fields } : {}), ...(input.note !== undefined ? { note: input.note } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,department,action" }).select().single();
  if (error) throw new Error(error.message);
  return data as AuthorityRule;
};

const vndOf = (c: EngineCtx, n: number) => formatVnd(n, c.locale);

/** Words that name each action in the owner's message (vi + en); a rule change needs one of them. */
const ACTION_WORDS: Record<FlowAction, ReadonlyArray<string>> = {
  reply_customer: ["trả lời khách", "tư vấn", "chatbot", "reply", "answer customer"],
  handoff_lead: ["chuyển lead", "chuyển cho sales", "handoff", "hand off", "lead"],
  classify_lead: ["phân loại", "classify"],
  send_follow_up: ["follow-up", "follow up", "followup", "theo dõi", "nhắn lại", "chăm sóc lại"],
  send_quote: ["báo giá", "quote"],
  confirm_order: ["đơn", "order"],
  send_care: ["chăm sóc", "care"],
  issue_invoice: ["hóa đơn", "hoá đơn", "invoice", "xuất hđ"],
  reconcile_payment: ["đối soát", "thanh toán", "chuyển khoản", "payment", "reconcile"],
};

/** "trên / quá / hơn / over / above <amount> … hỏi / ask": an amount threshold. */
const THRESHOLD = /(trên|quá|hơn|vượt|over|above|more than)\s*[\d.,]+\s*(triệu|tr|m|k|nghìn|million)?.*(hỏi|ask)/u;

/** Actions whose rule carries a VND limit. */
const LIMITED = new Set<FlowAction>(["confirm_order", "issue_invoice", "reconcile_payment", "send_quote"]);

/** "dưới 20 triệu" / "trên 1,5 tỷ" / "over 20m" → VND; null when the message names no amount limit. */
const amountIn = (said: string): number | null => {
  const m = said.match(/(?:dưới|trên|quá|tới|đến|tối đa|không quá|hơn|vượt|under|below|over|above|up to|max)\s*([\d]+(?:[.,]\d+)?)\s*(tỷ|ty|triệu|trieu|tr|m|k|nghìn|ngàn|million|billion)?/u);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const unit = m[2] ?? "";
  const mult = /tỷ|ty|billion/.test(unit) ? 1e9 : /triệu|trieu|tr|m|million/.test(unit) ? 1e6 : /k|nghìn|ngàn/.test(unit) ? 1e3 : 1;
  const v = Math.round(n * mult);
  return Number.isFinite(v) && v > 0 ? v : null;
};

export const applyAuthorityCore = async (c: EngineCtx, text: string) => {
  const t = T(c);
  const g = G(c);
  const current = ((await c.db.from("authority").select("*").eq("workspace_id", c.ws).maybeSingle()).data ?? null) as Authority | null;
  const rules = ((await c.db.from("authority_rules").select("*").eq("workspace_id", c.ws)).data ?? []) as Array<AuthorityRule>;
  const ch = await ai.parseAuthorityChat(text, rules.map((r) => `${r.action}=${r.mode}${r.limit_vnd !== null ? `(limit ${r.limit_vnd})` : ""}`).join(", "));
  const parts: Array<string> = [];
  const patch: Record<string, unknown> = {};
  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  const rev = int(ch.goals.revenue_vnd);
  if (rev !== null) { patch.goal_revenue_vnd = rev; parts.push(t("chatGoalRevenue", { amount: vndOf(c, rev) })); }
  const nc = int(ch.goals.new_customers);
  if (nc !== null) { patch.goal_new_customers = nc; parts.push(t("chatGoalCustomers", { n: nc })); }
  const fr = int(ch.goals.first_reply_minutes);
  if (fr !== null && fr > 0) { patch.goal_first_reply_minutes = fr; parts.push(t("chatGoalReply", { n: fr })); }
  if (ch.goals.note?.trim()) patch.goal_note = ch.goals.note.trim();
  if (ch.policies_add.length) {
    patch.policies = [current?.policies?.trim(), ...ch.policies_add].filter(Boolean).join("\n");
    parts.push(t("chatPolicies", { n: ch.policies_add.length }));
  }
  if (ch.reply_style?.trim()) { patch.reply_style = ch.reply_style.trim(); parts.push(t("chatReplyStyle")); }
  if (ch.brand_voice?.trim()) { patch.brand_voice = ch.brand_voice.trim(); parts.push(t("chatBrandVoice")); }
  if (ch.limits_note_add?.trim()) {
    patch.limits_note = [current?.limits_note?.trim(), ch.limits_note_add.trim()].filter(Boolean).join("\n");
    parts.push(t("chatLimits"));
  }
  const authority = Object.keys(patch).length ? await saveAuthorityCore(c, patch) : (current as Authority);

  const changedRules: Array<AuthorityRule> = [];
  const said = text.toLowerCase().normalize("NFC");
  // Deterministic backstop for the model: "đơn (hàng) dưới/trên/tới 20 triệu" always carries the order limit.
  const amount = amountIn(said);
  if (amount !== null && ACTION_WORDS.confirm_order.some((w) => said.includes(w)) && !ch.rules.some((r) => r.action === "confirm_order")) {
    ch.rules.push({ action: "confirm_order", mode: null, limit_vnd: amount });
  }
  for (const r of ch.rules) {
    if (LIMITED.has(r.action as FlowAction) && (r.limit_vnd === null || r.limit_vnd === undefined) && amount !== null) r.limit_vnd = amount;
    const action = r.action as FlowAction;
    if (!ACTIONS.includes(action)) continue;
    // Only rules the owner actually named change; the model must never rewrite the whole table from a vague sentence.
    if (!ACTION_WORDS[action].some((w) => said.includes(w))) continue;
    const existing = rules.find((x) => x.action === action);
    // "đơn trên 20 triệu thì hỏi tôi" = do it alone strictly below 20M (confirmed as "dưới 20.000.000 đ"), ask otherwise.
    const isThreshold = r.limit_vnd !== null && r.limit_vnd !== undefined && THRESHOLD.test(said);
    const mode = isThreshold ? "auto" : r.mode && MODES.includes(r.mode) ? r.mode : existing?.mode ?? "ask";
    const limit = r.limit_vnd === undefined || r.limit_vnd === null ? existing?.limit_vnd ?? null : int(r.limit_vnd);
    if (existing && existing.mode === mode && existing.limit_vnd === limit) continue;
    const saved = await saveRuleCore(c, { department: ACTION_DEPARTMENT[action], action, mode, limit_vnd: limit });
    changedRules.push(saved);
    parts.push(t("chatRule", { dept: g(`dept_${saved.department}`), action: g(`action_${action}`), mode: g(`mode_${mode}`) }) + (limit !== null && mode === "auto" ? ` (${t("chatRuleLimit", { amount: money(c, limit) })})` : ""));
  }

  if (!parts.length) return { summary: t("chatAuthorityNothing"), authority, rules };
  const changes = parts.join("; ");
  for (const r of changedRules) {
    const before = rules.find((x) => x.action === r.action) ?? null;
    await logDecision(c.db, c.ws, {
      work_item_id: null, lead_id: null, department: r.department, action: r.action, decided_by: c.actor, decider_kind: "owner", outcome: "edited",
      note: t("authorityDecisionNote", { changes }), before, after: r,
    });
  }
  await logEvidence(c.db, c.ws, { kind: "authority.updated", actor: c.actor, summary: t("authorityDecisionNote", { changes }), evidence: text });
  const allRules = ((await c.db.from("authority_rules").select("*").eq("workspace_id", c.ws)).data ?? []) as Array<AuthorityRule>;
  return { summary: t("chatAuthoritySaved", { changes }), authority, rules: allRules };
};

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

const REJECT_RE = /^(tu choi|khong duyet|khong dong y|khong chap nhan|reject|decline|no\b|huy|bo qua)/;
const APPROVE_RE = /^(dong y|duyet|approve|chap nhan|tiep tuc|cu lam)/;
/** Casual words count as approval only when NIVO is addressed ("@nivo ok"). */
const APPROVE_WEAK_RE = /^(ok\b|oke|okay|yes\b|go ahead|lam di)/;

/** "45 triệu", "45tr", "3,5 triệu", "45.000.000", "3000000 vnd" → VND. */
const parseVnd = (s: string): number | null => {
  const f = fold(s);
  const m1 = f.match(/(\d+(?:[.,]\d+)?)\s*(trieu|tr\b|m\b|million)/);
  if (m1) return Math.round(Number(m1[1].replace(",", ".")) * 1_000_000);
  const m2 = f.match(/(\d{1,3}(?:[.,]\d{3})+|\d{5,})/);
  if (m2) return Number(m2[1].replace(/[.,]/g, ""));
  return null;
};

type WaitingRow = WorkItem & { lead: { contact_name: string } | null };

/** "5.000.000 đ" in Vietnamese (what the owner reads on the cards), the locale currency otherwise. */
const money = (c: EngineCtx, n: number) => (c.locale === "vi" ? `${new Intl.NumberFormat("vi-VN").format(n)} đ` : vndOf(c, n));

const HONORIFIC = /^(anh|chi|em|co|chu|ong|ba|bac|di|thay|mr|mrs|ms)\s+/;
const HONOR_WORDS = new Set(["anh", "chi", "em", "co", "chu", "ong", "ba", "bac", "di", "thay", "mr", "mrs", "ms", "khach", "hang"]);
/** "chị Lan", "anh tuấn", "khách (hàng) Hùng": the word after the cue names a person. */
const PERSON_CUE = /(?:^|[^a-z])(?:anh|chi|co|chu|ong|ba|bac|khach(?: hang)?)\s+([a-z]+)/g;
/** Words after a cue (or capitalised mid-sentence) that are not names. */
const NOT_NAME = new Set(["ay", "nay", "do", "kia", "hang", "oi", "nhe", "nha", "a", "ha", "la", "da", "cua", "voi", "va", "thi", "duyet", "dong", "tu", "ok", "oke", "yes", "no", "don", "hoa", "bao", "gia", "cam", "on", "i", "the", "order", "invoice", "approve", "reject", "vnd"]);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word containment on folded text ("minh" is in "don cua anh minh", not in "minhanh"). */
const hasWord = (hay: string, needle: string) => needle.length >= 2 && new RegExp(`(?:^|[^a-z0-9])${esc(needle)}(?:$|[^a-z0-9])`).test(hay);
/** Order / invoice / bank references typed by the owner: "FB-1234", "INV-202609-0001", "DH123". */
const REF_RE = /[a-z]{1,6}-?\d{3,}(?:-\d+)*/gi;

const customerOf = (w: WaitingRow): string => {
  const f = w.proposal?.fields ?? {};
  return (w.lead?.contact_name || (typeof f.customer === "string" ? f.customer : "") || (typeof f.payer === "string" ? f.payer : "")).trim();
};
const refOf = (w: WaitingRow): string => {
  const f = w.proposal?.fields ?? {};
  const r = [f.order_no, f.reference, f.invoice_no].find((x): x is string => typeof x === "string" && x.trim().length >= 3);
  return r?.trim() ?? "";
};
const amountOf = (w: WaitingRow): number | null => {
  const a = w.proposal?.amount_vnd ?? w.proposal?.fields?.amount_vnd;
  return typeof a === "number" && Number.isFinite(a) ? a : null;
};

/** "Xác nhận đơn hàng FB-1234 · Anh Minh · 5.000.000 đ": exactly what a typed decision applies to. */
const describe = (c: EngineCtx, w: WaitingRow, amountOverride?: number) => {
  const ref = refOf(w);
  const amount = amountOverride ?? amountOf(w);
  return [`${G(c)(`action_${w.action}`)}${ref ? ` ${ref}` : ""}`, customerOf(w), amount !== null ? money(c, amount) : ""].filter(Boolean).join(" · ");
};

const ACTION_HINTS: Array<[RegExp, FlowAction]> = [
  [/hoa don|invoice/, "issue_invoice"],
  [/thanh toan|chuyen khoan|doi soat|payment|reconcile/, "reconcile_payment"],
  [/bao gia|quote/, "send_quote"],
  [/(?:^|[^a-z])don(?:$|[^a-z])|order/, "confirm_order"],
  [/follow|theo doi|nhan lai/, "send_follow_up"],
  [/tra loi|answer|reply/, "reply_customer"],
  [/cham soc|care/, "send_care"],
  [/phan loai|classify/, "classify_lead"],
];

/**
 * Decisions typed in Office ("@nivo đồng ý", "duyệt đơn của Anh Minh", "từ chối FB-1234").
 * A typed decision acts only when it identifies exactly ONE waiting item: either one item is waiting (and the text names
 * nothing that contradicts it), or every clue named in the text (customer, amount, order ref, kind of work) matches exactly
 * one item. Nothing falls back to "the latest": otherwise NIVO lists what is waiting and changes nothing.
 * Never more than one item per message. A payment reconciliation (unclear bank credit) is never approved by text.
 */
const decideFromChat = async (c: EngineCtx, text: string, decision: "approved" | "rejected", addressed: boolean, by: Decider) => {
  const t = T(c);
  const waiting = ((await c.db.from("work_items").select("*, lead:leads(contact_name)").eq("workspace_id", c.ws).eq("status", "waiting_decision").order("created_at").limit(100)).data ?? []) as Array<WaitingRow>;
  if (!waiting.length) return addressed ? { handled: true, reply: t("chatNoWaiting"), posted: false } : { handled: false, posted: false };
  const f = fold(text);

  // Customer names found in the text (whole words, with or without "anh/chị …").
  const nameHits = new Map<string, string>();
  for (const w of waiting) {
    const full = fold(customerOf(w));
    if (!full) continue;
    const short = full.replace(HONORIFIC, "");
    const hit = [full, short].filter((v) => hasWord(f, v)).sort((a, b) => b.length - a.length)[0];
    if (hit) nameHits.set(w.id, hit);
  }
  // "Minh Anh" named: the item of plain "Minh" is not meant too.
  const hitNames = [...nameHits.values()];
  for (const [id, v] of [...nameHits]) if (hitNames.some((o) => o !== v && o.includes(v))) nameHits.delete(id);
  // People the owner names ("chị Lan", "Anh Tuấn", "khách Hùng") must be the item's customer, even when only one item
  // waits: "đồng ý đơn của Chị Lan" never approves Anh Minh's order.
  const mentions = new Set<string>();
  for (const m of f.matchAll(PERSON_CUE)) if (m[1].length >= 2 && !NOT_NAME.has(m[1]) && !HONOR_WORDS.has(m[1])) mentions.add(m[1]);
  let first = true;
  for (const m of text.matchAll(/([.!?:;]\s*)?([\p{L}\p{N}-]+)/gu)) {
    const word = m[2];
    const isStart = first || !!m[1];
    first = false;
    if (isStart || /\d/.test(word) || !/^\p{Lu}/u.test(word)) continue;
    const w = fold(word);
    if (w.length >= 2 && !NOT_NAME.has(w) && !HONOR_WORDS.has(w) && w !== "nivo") mentions.add(w);
  }

  const refTokens = [...f.matchAll(REF_RE)].map((m) => m[0].replace(/-/g, ""));
  const refHit = (w: WaitingRow) => {
    const r = fold(refOf(w));
    return !!r && (refTokens.includes(r.replace(/-/g, "")) || hasWord(f, r));
  };
  const refNamed = refTokens.length > 0 || waiting.some(refHit);
  const amount = parseVnd(text.replace(REF_RE, " "));
  const action = ACTION_HINTS.find(([re]) => re.test(f))?.[1] ?? null;
  const identified = nameHits.size > 0 || refNamed;

  // Every clue given is a hard filter.
  let pool = waiting;
  if (nameHits.size) pool = pool.filter((w) => nameHits.has(w.id));
  if (mentions.size) pool = pool.filter((w) => [...mentions].every((m) => hasWord(fold(customerOf(w)), m)));
  if (refNamed) pool = pool.filter(refHit);
  // An amount matches the item's amount, or fills a missing amount on an item already identified (or the only one waiting).
  if (amount !== null) pool = pool.filter((w) => amountOf(w) === amount || (w.missing_fields.includes("amount_vnd") && (identified || waiting.length === 1)));
  if (action) pool = pool.filter((w) => w.action === action);
  const clues = identified || mentions.size > 0 || amount !== null || action !== null;

  const verb = t(decision === "approved" ? "chatVerbApprove" : "chatVerbReject");
  const example = (w: WaitingRow | undefined) => (w ? `${verb} ${refOf(w) || customerOf(w) || money(c, amountOf(w) ?? 0)}` : "");
  const listOf = (items: Array<WaitingRow>) => {
    const shown = items.slice(0, 6).map((w, i) => `${i + 1}) ${describe(c, w)}`).join("; ");
    return items.length > 6 ? `${shown}; ${t("chatMoreWaiting", { n: items.length - 6 })}` : shown;
  };

  const target = pool.length === 1 && (clues || waiting.length === 1) ? pool[0] : null;
  if (!target) {
    if (pool.length === 0) return { handled: true, reply: t("chatNoMatch", { list: listOf(waiting), example: example(waiting[0]) }), posted: false };
    return { handled: true, reply: t("chatWhich", { n: pool.length, verb, list: listOf(pool), example: example(pool[0]) }), posted: false };
  }
  if (decision === "approved" && target.action === "reconcile_payment") {
    return { handled: true, reply: t("chatReconcileNeedsCard", { item: describe(c, target) }), posted: false };
  }
  const edits: WorkEdits = {};
  if (amount !== null && decision === "approved" && target.missing_fields.includes("amount_vnd")) edits.amount_vnd = amount;
  try {
    await resumeWork(c, target.id, decision, edits, by, t("chatDecisionNote"));
    // Echo exactly what was decided in the thread (the engine's own Office post comes on top of it).
    const word = t(decision === "approved" ? "chatApprovedWord" : "chatRejectedWord");
    return { handled: true, reply: t("chatDecided", { decision: word, summary: describe(c, target, edits.amount_vnd ?? undefined) }), posted: false };
  } catch (e) {
    return { handled: true, reply: e instanceof Error ? e.message : String(e), posted: false };
  }
};

/** Shared by handleOwnerChat and sendTeamMessage: `posted` tells whether the engine already wrote the confirmation in Office. */
export const ownerChat = async (c: EngineCtx, text: string, by: Decider): Promise<{ handled: boolean; reply?: string; posted: boolean }> => {
  const raw = text.trim();
  const addressed = /@nivo\b/i.test(raw);
  // Authority commands and typed decisions are for owner and manager; a staff member only gets a friendly "not allowed" when they address NIVO.
  if (by.kind === "staff") return addressed ? { handled: true, reply: translator(access, c.locale)("forbidden"), posted: false } : { handled: false, posted: false };
  const body = raw.replace(/@nivo\b[:,]?/gi, "").trim();
  const otherHandles = [...body.matchAll(/@([a-z0-9-]+)/gi)].length > 0;
  if (!addressed && otherHandles) return { handled: false, posted: false }; // an agent is mentioned: normal Office reply
  const f = fold(body);
  const decision = REJECT_RE.test(f) ? "rejected" : APPROVE_RE.test(f) || (addressed && APPROVE_WEAK_RE.test(f)) ? "approved" : null;
  if (decision) {
    const r = await decideFromChat(c, body, decision, addressed, by);
    if (r.handled) return r;
  }
  if (addressed) {
    try {
      const out = await applyAuthorityCore(c, body);
      return { handled: true, reply: out.summary, posted: false };
    } catch (e) {
      return { handled: true, reply: e instanceof Error ? e.message : String(e), posted: false };
    }
  }
  return { handled: false, posted: false };
};

