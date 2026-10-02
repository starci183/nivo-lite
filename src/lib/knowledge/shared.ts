/** Knowledge layers: pure types and the "Nên bổ sung" suggestion catalogue (no I/O, safe in client components). */
import { MODULE_KEYS, type ModuleKey } from "../modules-shared";

/** Format of a source (not a business category): what the owner pasted or uploaded. */
export const SOURCE_KINDS = ["text", "faq", "file", "url"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type SourceStatus = "pending" | "indexing" | "ready" | "failed";
/** public: customer-facing agents may answer from it. internal: internal agents and staff only. */
export type Visibility = "public" | "internal";
/** Who the answer is for. `customer` only ever sees public passages (enforced in match_knowledge). */
export type Audience = "customer" | "internal";
export type NivoKind = "playbook" | "authority" | "escalation" | "setup_checklist" | "tone";
export type KnowledgeModule = ModuleKey | "core";

export type KnowledgeSource = {
  id: string;
  workspaceId: string;
  /** null = shared by every module (the default) */
  module: ModuleKey | null;
  kind: SourceKind;
  topic: string | null;
  tags: Array<string>;
  visibility: Visibility;
  title: string;
  content: string;
  status: SourceStatus;
  error: string | null;
  chunkCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChunk = { id: string; ord: number; content: string; hasEmbedding: boolean };

export type NivoItem = { id: string; module: KnowledgeModule; slug: string; title: string; body: string; kind: NivoKind; version: number; updatedAt: string };

/** One retrieved passage, labelled by layer: `nivo` = Tri thức NIVO, `business` = Tri thức doanh nghiệp. */
export type Passage = {
  layer: "nivo" | "business";
  id: string;
  sourceId: string | null;
  module: string | null;
  kind: string;
  title: string;
  content: string;
  score: number;
  visibility: Visibility;
  topic: string | null;
};

export type Citation = { layer: "nivo" | "business"; id: string; sourceId: string | null; title: string; topic: string | null };

export type AddSourceInput = {
  kind: SourceKind;
  title: string;
  content: string;
  topic?: string | null;
  tags?: Array<string>;
  module?: ModuleKey | null;
  visibility?: Visibility;
};

export const MAX_SOURCE_CHARS = 120_000;

/* ------------------------------------------------------------------ suggestions ("Nên bổ sung") */

/** A suggestion is a prompt to add something, never a requirement: the owner may add it, mark it not applicable, or dismiss it. */
export type KnowledgeSuggestion = {
  key: string;
  /** Modules whose NIVO setup checklist this comes from; the suggestion shows when at least one is installed. */
  modules: ReadonlyArray<ModuleKey>;
  /** Business types it fits (workspaces.business_type); omitted = any. */
  businessTypes?: ReadonlyArray<string>;
  topic_vi: string;
  topic_en: string;
  hint_vi: string;
  hint_en: string;
  /** Matching setup-gate keys it can cover (used to tell the setup AI that a dismissed suggestion needs no question). */
  gates: ReadonlyArray<string>;
  /** Whether the content is normally safe for customers to see. */
  visibility: Visibility;
};

export const KNOWLEDGE_SUGGESTIONS: ReadonlyArray<KnowledgeSuggestion> = [
  {
    key: "about", modules: ["chatbot", "sales"], gates: ["identity"], visibility: "public",
    topic_vi: "Giới thiệu doanh nghiệp", topic_en: "About the business",
    hint_vi: "Bạn là ai, làm nghề gì, phục vụ ai, ở đâu. Chatbot dùng để chào và giới thiệu.", hint_en: "Who you are, what you do, who you serve, where.",
  },
  {
    key: "offerings", modules: ["chatbot", "sales"], gates: ["products", "offer_pricing"], visibility: "public",
    topic_vi: "Sản phẩm, dịch vụ và giá", topic_en: "Products, services and prices",
    hint_vi: "Nếu có bán cho khách: danh sách và giá hoặc cách báo giá. Không bán trực tiếp thì chọn Không áp dụng.", hint_en: "If you sell to customers: items and prices or how you quote.",
  },
  {
    key: "faq", modules: ["chatbot"], gates: ["support_scope"], visibility: "public",
    topic_vi: "Câu hỏi khách thường gặp", topic_en: "Frequently asked questions",
    hint_vi: "Những câu khách hay hỏi kèm câu trả lời bạn muốn Chatbot dùng.", hint_en: "What customers often ask and the answers you want used.",
  },
  {
    key: "hours_location", modules: ["chatbot"], gates: ["hours_sla"], visibility: "public",
    topic_vi: "Giờ làm việc và địa chỉ", topic_en: "Opening hours and address",
    hint_vi: "Giờ mở cửa, ngày nghỉ, địa chỉ, cách liên hệ.", hint_en: "Opening hours, days off, address, how to reach you.",
  },
  {
    key: "policies", modules: ["chatbot", "sales"], businessTypes: ["retail", "services", "clinic", "education"], gates: ["prohibited", "offer_pricing"], visibility: "public",
    topic_vi: "Chính sách với khách", topic_en: "Customer policies",
    hint_vi: "Đổi trả, bảo hành, hủy lịch, hoàn tiền: những gì khách được hưởng.", hint_en: "Returns, warranty, cancellations, refunds.",
  },
  {
    key: "who_handles", modules: ["chatbot", "sales"], gates: ["handoff"], visibility: "internal",
    topic_vi: "Ai xử lý việc gì", topic_en: "Who handles what",
    hint_vi: "Khi cần chuyển người, ai nhận loại việc nào và liên lạc ra sao.", hint_en: "Who takes which kind of handoff and how to reach them.",
  },
  {
    key: "qualification", modules: ["sales"], gates: ["qualification"], visibility: "internal",
    topic_vi: "Khách nào đáng theo đuổi", topic_en: "Which leads are worth pursuing",
    hint_vi: "Tiêu chí khách phù hợp và khách nên bỏ qua.", hint_en: "Criteria for good-fit leads and leads to drop.",
  },
  {
    key: "approval_process", modules: ["sales", "accounting"], gates: ["approval_thresholds", "approval_policy"], visibility: "internal",
    topic_vi: "Quy trình duyệt và ngưỡng duyệt", topic_en: "Approval process and thresholds",
    hint_vi: "Việc nào bạn duyệt, từ số tiền nào, ai duyệt thay khi bạn vắng.", hint_en: "What you approve, from what amount, and who covers for you.",
  },
  {
    key: "payment_methods", modules: ["accounting", "chatbot"], gates: ["source_evidence", "scope"], visibility: "internal",
    topic_vi: "Cách nhận thanh toán", topic_en: "How you get paid",
    hint_vi: "Tài khoản nhận tiền, nội dung chuyển khoản cần ghi, hạn thanh toán thường dùng.", hint_en: "Receiving account, transfer reference, usual payment terms.",
  },
  {
    key: "invoicing_tax", modules: ["accounting"], gates: ["currency_tax", "evidence_requirements"], visibility: "internal",
    topic_vi: "Hóa đơn và thuế", topic_en: "Invoicing and tax",
    hint_vi: "Thông tin xuất hóa đơn, thuế GTGT, chứng từ cần có. Không xuất hóa đơn thì chọn Không áp dụng.", hint_en: "Invoice details, VAT, required documents.",
  },
  {
    key: "brand_voice", modules: MODULE_KEYS, gates: ["tone"], visibility: "internal",
    topic_vi: "Cách xưng hô và giọng điệu mẫu", topic_en: "Voice and sample replies",
    hint_vi: "Vài câu mẫu bạn ưng ý để agent nói đúng giọng của bạn.", hint_en: "A few sample replies you like.",
  },
];

/** Suggestions that fit the installed modules and the workspace's business type. */
export const suggestionsFor = (installed: ReadonlyArray<ModuleKey>, businessType: string | null | undefined): Array<KnowledgeSuggestion> =>
  KNOWLEDGE_SUGGESTIONS.filter((s) =>
    s.modules.some((m) => installed.includes(m)) &&
    (!s.businessTypes || !businessType || s.businessTypes.includes(businessType)));

export const suggestionTopic = (s: KnowledgeSuggestion, locale: "vi" | "en"): string => (locale === "vi" ? s.topic_vi : s.topic_en);
export const suggestionHint = (s: KnowledgeSuggestion, locale: "vi" | "en"): string => (locale === "vi" ? s.hint_vi : s.hint_en);
