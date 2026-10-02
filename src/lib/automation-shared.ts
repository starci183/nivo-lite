/**
 * "Tự động hoá": types and pure helpers for the ready-made automations a shop owner switches on. No I/O, safe in client components.
 * The DEFINITIONS are data: resources/automation-templates/<key>.json (loaded by automation-templates.ts, synced to the
 * `automation_templates` table by `npm run seed:automations`). A definition is generic (keyed to events every business has); the shop's own
 * wording is generated ONCE at enable time from the active context and stored on the pipeline (body), the owner approves it.
 * Every customer-facing send goes through the authority gate (work_items): the owner's rule for the template's action decides whether the
 * message leaves by itself or waits as a decision. Nothing here sends anything.
 */
import type { ModuleKey } from "./module-registry";
export type L = { readonly vi: string; readonly en: string };
export type ModuleScope = ModuleKey;

export type TemplateKey = string;
export type ConfigValue = string | number | boolean;
export type PipelineConfig = Readonly<Record<string, ConfigValue>>;

/** What a shop may have, derived from its active context, knowledge and data (never asked directly). */
export type Capability =
  | "has_opening_hours" | "has_deposits" | "has_due_dates" | "has_appointments" | "sells_online" | "has_recurring_contracts" | "has_delivery";
/** What the business talks to customers on. "customer_chat": a Telegram / Zalo OA connection or the website chat. */
export type ChannelNeed = "customer_chat";
export type ConnectionNeed = "google" | "webhook" | "smtp";

export type Requires = {
  readonly modules: ReadonlyArray<ModuleScope>;
  readonly channels: ReadonlyArray<ChannelNeed>;
  readonly connections: ReadonlyArray<ConnectionNeed>;
  readonly capabilities: ReadonlyArray<Capability>;
};

/** One setting on a template card (the message body is separate: see contentMode). */
export type FieldDef =
  | { readonly key: string; readonly kind: "number"; readonly label: L; readonly hint?: L; readonly min: number; readonly max: number; readonly suffix?: L }
  | { readonly key: string; readonly kind: "text" | "email"; readonly label: L; readonly hint?: L; readonly maxLength?: number }
  | { readonly key: string; readonly kind: "time"; readonly label: L; readonly hint?: L }
  | { readonly key: string; readonly kind: "toggle"; readonly label: L; readonly hint?: L };

/** The authority action a message goes through (src/lib/policy.ts); null = sends nothing to a customer. */
export type GateAction = "send_care" | "send_follow_up" | "reply_customer" | "send_email" | "remind_booking" | null;

/**
 * fixed         fill the variables only; no model call; deterministic. Default authority: auto.
 * ai_per_case   the model writes each message within the approved body and the guardrails; customer-facing sends default to ASK.
 * none          sends no customer message (reports, data pushes).
 */
export type ContentMode = "fixed" | "ai_per_case" | "none";

export type TemplatePack = "core" | "email" | "appointments" | "marketplace" | "contracts" | "delivery";

export type TemplateDef = {
  readonly key: TemplateKey;
  readonly version: number;
  readonly pack: TemplatePack;
  /**
   * "implemented": run by src/lib/automation-engine.ts. "n8n": a shared n8n workflow (resources/n8n-templates/<key>.json) started through n8n_start_run().
   * "definition": the definition and gating exist, no executor yet (capability-gated packs).
   */
  readonly executor: "implemented" | "n8n" | "definition";
  /** executor "n8n": the webhook the engine calls and who receives the email. */
  readonly n8n?: { readonly webhook: string; readonly audience: "owner" | "customer" };
  /** Exactly one owner: a module, or null for a workspace-wide automation (daily report, backups, connection alerts). */
  readonly moduleKey: ModuleScope | null;
  readonly icon: "payment" | "leads" | "report" | "review" | "debt" | "winback" | "moon" | "sheet" | "calendar" | "cart" | "contract" | "truck" | "receipt" | "ledger";
  readonly name: L;
  /** One line. */
  readonly description: L;
  /** What starts it: an event every business has, or a schedule. `line` is the plain-words line on the card. */
  readonly trigger: { readonly kind: "event" | "schedule"; readonly event: string; readonly line: L };
  readonly requires: Requires;
  readonly settings: ReadonlyArray<FieldDef>;
  readonly contentMode: ContentMode;
  /** The NIVO frame: what the message must never do. Shown to the owner and given to the model. */
  readonly guardrails: ReadonlyArray<L>;
  /** Variable names usable in the body, without braces: ten_khach, ten_shop, so_tien, ma_phieu, gio_mo_cua, nhu_cau, uu_dai. */
  readonly variables: ReadonlyArray<string>;
  /** The starting wording, in the NIVO frame; the shop's own version is generated from its context when the owner switches the card on. */
  readonly defaultBody: L | null;
  readonly authority: { readonly action: GateAction; readonly alwaysAsk?: boolean };
  readonly defaults: PipelineConfig;
};

export const isTemplateKey = (v: unknown): v is TemplateKey => typeof v === "string" && /^[a-z][a-z0-9_-]{2,60}$/.test(v);

/** The saved config over the template defaults, every setting coerced to its kind and clamped. Keys that are not settings (a sheet id) are kept as they are. */
export const resolveConfig = (def: TemplateDef, saved: Readonly<Record<string, unknown>> | null | undefined): PipelineConfig => {
  const out: Record<string, ConfigValue> = { ...def.defaults };
  for (const [k, v] of Object.entries(saved ?? {})) if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  for (const f of def.settings) {
    const v = out[f.key];
    if (f.kind === "number") out[f.key] = Math.min(f.max, Math.max(f.min, Math.round(Number(v) || 0)));
    else if (f.kind === "toggle") out[f.key] = v === true || v === "true";
    else if (f.kind === "time") out[f.key] = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : String(def.defaults[f.key] ?? "00:00");
    else if (f.kind === "email") out[f.key] = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? "").trim()) ? String(v).trim().toLowerCase() : "";
    else out[f.key] = String(v ?? "").trim().slice(0, f.maxLength ?? 200) || String(def.defaults[f.key] ?? "");
  }
  return out;
};

/** What a message is written with: the shop's real context and, per case, the customer's. */
export type MessageVars = {
  ten_shop: string;
  gio_mo_cua?: string;
  ten_khach?: string;
  so_tien?: string;
  ma_phieu?: string;
  nhu_cau?: string;
  uu_dai?: string;
  /** Email templates: date, summary lines, waiting-decisions line, due date, period, days late. */
  ngay?: string;
  tom_tat?: string;
  viec_cho?: string;
  han?: string;
  ky?: string;
  so_ngay_tre?: string;
};

const NEUTRAL: Readonly<Record<string, string>> = {
  ten_shop: "shop", gio_mo_cua: "giờ làm việc của shop", ten_khach: "bạn", so_tien: "", ma_phieu: "", nhu_cau: "dịch vụ bạn quan tâm", uu_dai: "ưu đãi riêng",
};

/** Fill {ten_khach} {ten_shop} {gio_mo_cua} {so_tien} {ma_phieu} {nhu_cau} {uu_dai} and the email variables. An empty value reads as a neutral word, never as a raw {placeholder}. */
export const fillBody = (body: string, v: MessageVars): string =>
  body.replace(/\{([a-z_]+)\}/g, (_, k: string) => ((v as Readonly<Record<string, string | undefined>>)[k] ?? "").trim() || (NEUTRAL[k] ?? ""))
    .replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,!?])/g, "$1").trim();

/** A friendly sample customer for previews. */
export const SAMPLE_VARS = {
  ten_khach: "chị Lan", so_tien: "350.000 ₫", ma_phieu: "INV-202610-0012", nhu_cau: "gói chăm sóc da", uu_dai: "ưu đãi 10% cho lần quay lại",
  ngay: "02/10/2026", tom_tat: "- Khách mới: 3\n- Tiền về: 1.200.000 ₫ (2 giao dịch)\n- Hoá đơn quá hạn: 1 (350.000 ₫)", viec_cho: "Đang có 2 việc chờ bạn quyết định trong NIVO.",
  han: "25/09/2026", ky: "09/2026", so_ngay_tre: "7",
} as const;

export type AutomationRunStatus = "queued" | "running" | "done" | "skipped" | "waiting_approval" | "failed";
export const RUN_STATUS: ReadonlyArray<AutomationRunStatus> = ["queued", "running", "done", "skipped", "waiting_approval", "failed"];

export type RunStep = { readonly label: string; readonly status: "done" | "skipped" | "waiting" | "failed"; readonly detail?: string };

/** One row of the run history, as the screen shows it. */
export type AutomationRunView = {
  readonly id: string;
  readonly pipelineId: string;
  readonly templateKey: TemplateKey;
  readonly status: AutomationRunStatus;
  readonly triggerRef: string;
  /** Plain-words one line: "Đã gửi cảm ơn tới chị Lan". */
  readonly summary: string;
  readonly steps: ReadonlyArray<RunStep>;
  readonly evidence: string | null;
  readonly error: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  /** The decision this run is waiting for (Office), when status is waiting_approval. */
  readonly workItemId: string | null;
  /** The message that was (or will be) sent, when there is one. */
  readonly message: string | null;
};

/** Why a template cannot be switched on yet. `href` is where the owner fixes it. */
export type Missing = { readonly kind: "module" | "channel" | "connection" | "capability"; readonly key: string; readonly label: L; readonly href: string };

/** A template card's state, assembled on the server. */
export type AutomationCardView = {
  readonly key: TemplateKey;
  readonly def: TemplateDef;
  readonly pipelineId: string | null;
  readonly enabled: boolean;
  /** The owner pressed "Không áp dụng": hidden from the gallery's proposals until restored. */
  readonly dismissed: boolean;
  readonly config: PipelineConfig;
  /** The approved message template of this shop (null until the owner approved one; the screen then shows the generated proposal). */
  readonly body: string | null;
  readonly bodyVersion: number;
  /** The active context version the body was written from, and the current one: differing means "Có thể cần cập nhật theo context mới". */
  readonly basedOnContext: number | null;
  readonly currentContext: number | null;
  readonly bodyStale: boolean;
  /** What will happen to a customer message under the owner's current authority: "auto" it leaves by itself, "ask" it waits for a decision, "never" it is not allowed. null = sends nothing. */
  readonly gate: "auto" | "ask" | "never" | null;
  /** Requirements not met (empty = applicable). A card needing only a connection is "Cần kết nối X"; anything else is "Chưa áp dụng được". */
  readonly missing: ReadonlyArray<Missing>;
  /** False for a capability-gated pack whose capability the shop does not have: the gallery does not show it at all (a core template that cannot apply is still shown, as "Chưa áp dụng được"). */
  readonly proposed: boolean;
  /** executor "definition": the definition and gating exist but nothing runs yet ("Sắp có"). */
  readonly comingSoon: boolean;
  readonly lastRunAt: string | null;
  readonly runCount: number;
  /** Trust ladder: consecutive owner approvals without edits, whether "Cho tự gửi" is on offer, and whether the owner accepted it. */
  readonly trust: { readonly streak: number; readonly offered: boolean; readonly autoSend: boolean };
  /** sheet_orders: "ready" (connected) | "missing" (no connection) | "lost" (token revoked) | "unavailable" (NIVO has not enabled the Google integration yet). */
  readonly google?: "ready" | "missing" | "lost" | "unavailable";
  readonly sheetUrl?: string | null;
};

/** The shop's real context shown in previews. */
export type ShopContext = { readonly shop: string; readonly hours: string; readonly tone: string };

/** After this many consecutive owner approvals without edits, NIVO suggests "Cho tự gửi" (applied only when the owner accepts). */
export const TRUST_THRESHOLD = 20;
