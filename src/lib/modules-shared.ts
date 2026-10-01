/** Module foundation: pure types and the setup-gate catalogue (no I/O, safe in client components). Re-exported by modules-core.ts. */
import type { ModuleKey } from "./types";

export type { ModuleKey };
export const MODULE_KEYS: ReadonlyArray<ModuleKey> = ["chatbot", "sales", "accounting"];
export const isModuleKey = (value: string | undefined | null): value is ModuleKey => value === "chatbot" || value === "sales" || value === "accounting";

export type InstallationStatus = "installing" | "setup" | "ready" | "live" | "paused";
export type OperatingMode = "assist" | "autopilot";

/** One installed module of a workspace. */
export type Installation = {
  id: string;
  workspaceId: string;
  moduleKey: ModuleKey;
  agentId: string | null;
  /** The agent's display name and handle (read-through, for headers and mentions). */
  agentName: string;
  agentHandle: string;
  status: InstallationStatus;
  operatingMode: OperatingMode;
  liveEnabled: boolean;
  activeContextVersionId: string | null;
  /** Number of the active context version, null before the first apply. */
  activeVersion: number | null;
  settings: Record<string, unknown>;
  createdAt: string;
};

export type SetupFact = { key: string; text: string };
export type GateStatus = "missing" | "proposed" | "confirmed";
export type GateEntry = { status: GateStatus; evidence: string; confirmed_by?: string | null; confirmed_at?: string | null };
export type GateEvidence = Record<string, GateEntry>;
export type DraftSnapshot = { summary: string; facts: SetupFact[] };

/** What a context version freezes: the draft plus the confirmed evidence per gate. */
export type ContextSnapshot = DraftSnapshot & { gates: GateEvidence };

/** An applied, immutable version of a module's business context. */
export type ContextVersion = {
  id: string;
  installationId: string;
  version: number;
  snapshot: ContextSnapshot;
  appliedBy: string;
  appliedAt: string;
};

/** The draft being built in the setup chat. */
export type SetupSession = {
  id: string;
  installationId: string;
  revision: number;
  status: "draft" | "applied" | "discarded";
  draft: DraftSnapshot;
  gateEvidence: GateEvidence;
  createdAt: string;
};

export type SetupMessage = { id: string; setupSessionId: string; role: "user" | "assistant"; author: string; body: string; createdAt: string };

export type ModuleGate = { key: string; label_vi: string; label_en: string; hint_vi: string; hint_en: string };

/** What each module must know before it may act. Every gate is required to apply a setup. */
export const MODULE_GATES: Record<ModuleKey, Array<ModuleGate>> = {
  chatbot: [
    { key: "identity", label_vi: "Thông tin doanh nghiệp", label_en: "Business identity",
      hint_vi: "Tên, bạn làm nghề gì, phục vụ ai, ở đâu.", hint_en: "Name, what you do, who you serve, where." },
    { key: "products", label_vi: "Sản phẩm và giá", label_en: "Products and prices",
      hint_vi: "Dịch vụ/sản phẩm chính và mức giá hoặc cách báo giá.", hint_en: "Main products or services and their prices or how you quote." },
    { key: "support_scope", label_vi: "Phạm vi hỗ trợ", label_en: "Support scope",
      hint_vi: "Chatbot được trả lời những gì và không trả lời những gì.", hint_en: "What the chatbot may answer and what it must leave alone." },
    { key: "channels", label_vi: "Kênh tiếp nhận", label_en: "Channels",
      hint_vi: "Khách nhắn qua đâu: website, Telegram, Zalo, Facebook...", hint_en: "Where customers write: website, Telegram, Zalo, Facebook..." },
    { key: "hours_sla", label_vi: "Giờ làm việc và thời gian phản hồi", label_en: "Hours and response time",
      hint_vi: "Giờ làm việc và bao lâu thì người thật trả lời.", hint_en: "Opening hours and how fast a person follows up." },
    { key: "handoff", label_vi: "Khi nào chuyển cho người", label_en: "Handoff rules",
      hint_vi: "Tình huống nào bot phải chuyển cho nhân viên và chuyển cho ai.", hint_en: "When the bot must hand over to a person, and to whom." },
    { key: "prohibited", label_vi: "Điều không được hứa", label_en: "Prohibited commitments",
      hint_vi: "Giá, lịch, bảo hành, hoàn tiền... bot không được tự cam kết.", hint_en: "Price, schedule, warranty, refunds... the bot must never promise." },
    { key: "tone", label_vi: "Giọng điệu", label_en: "Tone",
      hint_vi: "Cách xưng hô và phong cách trả lời.", hint_en: "How it addresses people and the style of its answers." },
  ],
  sales: [
    { key: "offer_pricing", label_vi: "Gói bán và quy tắc giá", label_en: "Offer and pricing rules",
      hint_vi: "Bạn bán gì, bảng giá, mức giảm tối đa.", hint_en: "What you sell, price list, maximum discount." },
    { key: "qualification", label_vi: "Tiêu chí khách tiềm năng", label_en: "Qualification criteria",
      hint_vi: "Khách thế nào là đáng theo đuổi, thế nào thì bỏ qua.", hint_en: "Which leads are worth pursuing and which to drop." },
    { key: "followup_cadence", label_vi: "Nhịp theo dõi", label_en: "Follow-up cadence",
      hint_vi: "Bao lâu theo dõi một lần, tối đa mấy lần.", hint_en: "How often to follow up and how many times at most." },
    { key: "approval_thresholds", label_vi: "Ngưỡng cần duyệt", label_en: "Approval thresholds",
      hint_vi: "Báo giá hoặc đơn từ bao nhiêu tiền thì cần bạn duyệt.", hint_en: "Quote or order amounts above which you must approve." },
    { key: "handoff_accounting", label_vi: "Chuyển sang Kế toán", label_en: "Handoff to accounting",
      hint_vi: "Khi nào đơn đã chốt và cần những thông tin gì để xuất hóa đơn.", hint_en: "When a deal counts as won and what accounting needs to invoice." },
    { key: "tone", label_vi: "Giọng điệu", label_en: "Tone",
      hint_vi: "Cách xưng hô và phong cách khi nhắn khách.", hint_en: "How it addresses customers and the style of its messages." },
  ],
  accounting: [
    { key: "scope", label_vi: "Phạm vi công việc", label_en: "Scope",
      hint_vi: "Kế toán AI làm những việc gì: hóa đơn, đối soát, nhắc nợ...", hint_en: "What the accounting agent covers: invoices, reconciliation, reminders..." },
    { key: "currency_tax", label_vi: "Tiền tệ và thuế", label_en: "Currency and tax",
      hint_vi: "Đơn vị tiền, thuế GTGT, quy tắc làm tròn.", hint_en: "Currency, VAT rate, rounding rules." },
    { key: "source_evidence", label_vi: "Nguồn chứng từ", label_en: "Source evidence",
      hint_vi: "Số liệu lấy từ đâu: đơn hàng, sao kê ngân hàng, file...", hint_en: "Where figures come from: orders, bank statements, files..." },
    { key: "approval_policy", label_vi: "Chính sách duyệt và ngưỡng", label_en: "Approval policy and thresholds",
      hint_vi: "Số tiền nào AI tự làm, số nào cần bạn duyệt.", hint_en: "Amounts the AI handles alone and amounts you approve." },
    { key: "evidence_requirements", label_vi: "Yêu cầu chứng từ", label_en: "Evidence requirements",
      hint_vi: "Cần những chứng từ nào trước khi xuất hóa đơn hoặc ghi nhận thanh toán.", hint_en: "Documents required before invoicing or recording a payment." },
    { key: "prohibited_actions", label_vi: "Việc không được làm", label_en: "Prohibited actions",
      hint_vi: "Những thao tác tuyệt đối không tự làm (hoàn tiền, hủy hóa đơn...).", hint_en: "Actions it must never take alone (refunds, voiding invoices...)." },
  ],
};

/** Gate state, defaulting to missing. */
export const gateEntry = (evidence: GateEvidence, key: string): GateEntry => evidence[key] ?? { status: "missing", evidence: "" };

/** True when every gate of the module is confirmed. */
export const allGatesConfirmed = (moduleKey: ModuleKey, evidence: GateEvidence): boolean =>
  MODULE_GATES[moduleKey].every((g) => gateEntry(evidence, g.key).status === "confirmed");

export const gateLabel = (g: ModuleGate, locale: "vi" | "en"): string => (locale === "vi" ? g.label_vi : g.label_en);
export const gateHint = (g: ModuleGate, locale: "vi" | "en"): string => (locale === "vi" ? g.hint_vi : g.hint_en);

/** What a version would freeze from a draft: summary, facts and the confirmed gates only. */
export const snapshotOf = (draft: DraftSnapshot, gates: GateEvidence): ContextSnapshot => ({
  summary: draft.summary,
  facts: draft.facts,
  gates: Object.fromEntries(Object.entries(gates).filter(([, g]) => g.status === "confirmed")),
});
