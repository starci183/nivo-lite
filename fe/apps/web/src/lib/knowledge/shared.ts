/** Knowledge layers: pure types and the "Nên bổ sung" suggestion catalogue (no I/O, safe in client components). */
import { OPEN_SOURCE_STATUSES, type SourceStatus } from "../jobs/contracts";
import { MODULE_KEYS, type ModuleKey } from "../modules-shared";

/** Format of a source (not a business category): what the owner pasted or uploaded. */
export const SOURCE_KINDS = ["text", "faq", "file", "url"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
/**
 * Where a source stands (src/lib/jobs/contracts.ts): the job queue writes queued -> reading -> indexing -> extracting_facts -> ready (or
 * failed / blocked_credits); `pending` is the older synchronous value, kept so existing rows still read.
 */
export type { SourceStatus };
/** Statuses a worker still has to move on: the Second Brain notice and the live list watch these. */
export const IN_FLIGHT_STATUSES: ReadonlyArray<SourceStatus> = OPEN_SOURCE_STATUSES;
/**
 * Statuses whose passages are indexed, so agents may read them: `extracting_facts` already has every passage stored (only the fact reading
 * is still running).
 */
export const READABLE_STATUSES: ReadonlyArray<SourceStatus> = ["ready", "extracting_facts"];
export const isInFlight = (status: string): boolean => (IN_FLIGHT_STATUSES as ReadonlyArray<string>).includes(status);
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
  /** null = shared by every instance of the module (the default); set = only that agent instance reads it */
  installationId: string | null;
  kind: SourceKind;
  topic: string | null;
  tags: Array<string>;
  visibility: Visibility;
  title: string;
  content: string;
  status: SourceStatus;
  error: string | null;
  chunkCount: number;
  /** 0-100 while a worker is on it. */
  progress: number;
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

/** `brain` = a fact of the shared brain, `data` = a data hub record (see src/lib/brain/recall.ts). */
export type Citation = { layer: "nivo" | "business" | "brain" | "data"; id: string; sourceId: string | null; title: string; topic: string | null };

export type AddSourceInput = {
  kind: SourceKind;
  title: string;
  content: string;
  topic?: string | null;
  tags?: Array<string>;
  module?: ModuleKey | null;
  visibility?: Visibility;
  /** Restrict the document to ONE agent instance (one branch's Chatbot); its module follows the instance. Omitted or null = every instance. */
  installationId?: string | null;
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
  /* booking */
  {
    key: "booking_services", modules: ["booking"], gates: ["services", "capacity"], visibility: "public",
    topic_vi: "Dịch vụ, thời lượng và giá", topic_en: "Services, durations and prices",
    hint_vi: "Mỗi dịch vụ một dòng: tên, thời lượng, giá. Ví dụ: Cắt tóc nam, 45 phút, 150.000đ; Nhuộm, 120 phút, từ 600.000đ.", hint_en: "One line per service: name, duration, price. E.g. Men's haircut, 45 min, 150,000đ; Colour, 120 min, from 600,000đ.",
  },
  {
    key: "booking_cancellation", modules: ["booking"], gates: ["cancel_policy"], visibility: "public",
    topic_vi: "Chính sách hủy lịch và đặt cọc", topic_en: "Cancellation and deposit policy",
    hint_vi: "Khi nào phải cọc và bao nhiêu, hủy muộn bị tính ra sao, đổi lịch tối đa mấy lần. Ví dụ: cọc 30% với dịch vụ trên 500.000đ; hủy trước 24 giờ hoàn cọc, muộn hơn mất cọc.", hint_en: "When a deposit is due and how much, what late cancellation costs, how many reschedules. E.g. 30% deposit above 500,000đ; refunded if cancelled 24h ahead.",
  },
  {
    key: "booking_resources", modules: ["booking"], gates: ["capacity", "hours_buffer"], visibility: "internal",
    topic_vi: "Nhân viên, phòng và thiết bị có thể đặt", topic_en: "Staff, rooms and equipment that can be booked",
    hint_vi: "Ai hoặc cái gì nhận lịch, làm được dịch vụ nào, mỗi giờ nhận tối đa mấy khách, thời gian đệm giữa hai lịch. Ví dụ: Lan làm nail và mi; phòng 2 chỉ massage; đệm 10 phút.", hint_en: "Who or what takes bookings, which services each can do, max parallel guests, buffer between slots. E.g. Lan does nails and lashes; room 2 massage only; 10 min buffer.",
  },
  {
    key: "booking_exceptions", modules: ["booking"], gates: ["hours_buffer", "reminders"], visibility: "public",
    topic_vi: "Giờ nhận lịch, ngày nghỉ và ngoại lệ", topic_en: "Booking hours, days off and exceptions",
    hint_vi: "Giờ nhận lịch thường ngày, ngày lễ nghỉ hoặc đổi giờ, ngày nhân viên vắng. Ví dụ: T2-T7 9:00-20:00; nghỉ 30/4 và 1/5; Tết nghỉ 7 ngày.", hint_en: "Regular booking hours, holidays closed or changed, days staff are away. E.g. Mon-Sat 9:00-20:00; closed 30 Apr and 1 May.",
  },
  /* loyalty */
  {
    key: "loyalty_points", modules: ["loyalty"], gates: ["earn_rules", "limits"], visibility: "public",
    topic_vi: "Quy tắc tích điểm", topic_en: "Points earning rules",
    hint_vi: "Chi bao nhiêu được bao nhiêu điểm, có nhân điểm không, giới hạn mỗi ngày hoặc mỗi đơn. Ví dụ: 10.000đ = 1 điểm; sinh nhật nhân đôi; không tích điểm khi dùng voucher.", hint_en: "How much spend earns how many points, multipliers, daily or per-order caps. E.g. 10,000đ = 1 point; double on birthdays; no points on voucher orders.",
  },
  {
    key: "loyalty_rewards", modules: ["loyalty"], gates: ["rewards", "promo_rules"], visibility: "public",
    topic_vi: "Danh mục quà đổi điểm", topic_en: "Rewards catalogue",
    hint_vi: "Mỗi quà một dòng: tên, số điểm, điều kiện, số lượng còn. Ví dụ: Nước miễn phí, 100 điểm; Voucher 50.000đ, 250 điểm, dùng trong 30 ngày.", hint_en: "One line per reward: name, points, conditions, stock. E.g. Free drink, 100 points; 50,000đ voucher, 250 points, valid 30 days.",
  },
  {
    key: "loyalty_tiers", modules: ["loyalty"], gates: ["tiers", "birthday"], visibility: "public",
    topic_vi: "Hạng thành viên và quyền lợi", topic_en: "Membership tiers and perks",
    hint_vi: "Tên hạng, điều kiện lên hạng và giữ hạng, quyền lợi từng hạng. Ví dụ: Bạc từ 0 điểm; Vàng từ 2.000 điểm/năm, giảm 5%, ưu tiên đặt lịch.", hint_en: "Tier names, how to reach and keep each, perks per tier. E.g. Silver from 0; Gold from 2,000 points a year, 5% off, priority booking.",
  },
  {
    key: "loyalty_expiry", modules: ["loyalty"], gates: ["expiry", "prohibited"], visibility: "public",
    topic_vi: "Hạn dùng điểm và điều khoản", topic_en: "Points expiry and terms",
    hint_vi: "Điểm hết hạn khi nào, báo trước ra sao, trường hợp bị trừ hoặc hủy điểm. Ví dụ: điểm hết hạn sau 12 tháng không phát sinh; hoàn đơn thì trừ điểm đã cộng.", hint_en: "When points expire, how members are warned, when points are removed. E.g. expire after 12 months idle; refunded orders reverse earned points.",
  },
  /* inventory */
  {
    key: "inventory_suppliers", modules: ["inventory"], gates: ["suppliers"], visibility: "internal",
    topic_vi: "Nhà cung cấp và điều khoản", topic_en: "Suppliers and terms",
    hint_vi: "Mỗi nhà cung cấp: hàng cung cấp, người liên hệ, thời gian giao, đơn tối thiểu, công nợ. Ví dụ: Cty An Phát, cà phê hạt, giao 2 ngày, tối thiểu 5 triệu, trả sau 15 ngày.", hint_en: "Per supplier: what they supply, contact, lead time, minimum order, payment terms. E.g. An Phat, coffee beans, 2-day delivery, 5M minimum, net 15.",
  },
  {
    key: "inventory_reorder", modules: ["inventory"], gates: ["reorder_levels", "approval_thresholds"], visibility: "internal",
    topic_vi: "Quy tắc đặt hàng lại", topic_en: "Reorder rules",
    hint_vi: "Mức tồn tối thiểu và số lượng đặt cho mặt hàng chính, đơn từ bao nhiêu tiền cần bạn duyệt. Ví dụ: sữa tươi còn dưới 10 hộp thì đặt 40 hộp; đơn trên 3 triệu cần duyệt.", hint_en: "Minimum stock and order quantity for key items, the order value that needs your approval. E.g. reorder 40 cartons of milk below 10; approve orders over 3M.",
  },
  {
    key: "inventory_units", modules: ["inventory"], gates: ["items"], visibility: "internal",
    topic_vi: "Đơn vị tính và công thức định lượng", topic_en: "Units and recipes",
    hint_vi: "Đơn vị mua và đơn vị dùng, quy đổi, định lượng mỗi món. Ví dụ: 1 thùng = 24 hộp; 1 ly latte dùng 18g cà phê + 200ml sữa.", hint_en: "Purchase vs usage units, conversions, quantity per item. E.g. 1 case = 24 cartons; one latte uses 18g coffee + 200ml milk.",
  },
  {
    key: "inventory_counts", modules: ["inventory"], gates: ["stock_count"], visibility: "internal",
    topic_vi: "Lịch kiểm kho và hao hụt cho phép", topic_en: "Stock count schedule and allowed loss",
    hint_vi: "Bao lâu kiểm một lần, ai kiểm, mức hao hụt chấp nhận, hàng hết hạn xử lý ra sao. Ví dụ: kiểm cuối tuần; hao hụt dưới 2%; hàng sắp hết hạn giảm giá trước 3 ngày.", hint_en: "How often and who counts, acceptable shrinkage, how expiring stock is handled. E.g. weekly count; under 2% loss; discount 3 days before expiry.",
  },
  /* shifts */
  {
    key: "shifts_positions", modules: ["shifts"], gates: ["staff_roles", "labor_limits"], visibility: "internal",
    topic_vi: "Vị trí và quy định trả lương", topic_en: "Positions and pay rules",
    hint_vi: "Từng vị trí cần bao nhiêu người mỗi ca, mức lương giờ hoặc ca, phụ cấp, hệ số tăng ca và lễ. Ví dụ: Phục vụ 28.000đ/giờ; tăng ca x1,5; lễ x3.", hint_en: "Headcount per position per shift, hourly or per-shift pay, allowances, overtime and holiday multipliers. E.g. Waiter 28,000đ/h; overtime x1.5; holiday x3.",
  },
  {
    key: "shifts_rules", modules: ["shifts"], gates: ["opening_hours", "coverage"], visibility: "internal",
    topic_vi: "Quy tắc xếp ca", topic_en: "Shift rules",
    hint_vi: "Giờ từng ca, số giờ tối đa mỗi tuần, nghỉ giữa hai ca, ai không xếp ca đêm. Ví dụ: sáng 7-15, tối 15-23; tối đa 48 giờ/tuần; nghỉ ít nhất 10 giờ giữa hai ca.", hint_en: "Shift times, weekly hour cap, rest between shifts, who is not rostered at night. E.g. morning 7-15, evening 15-23; max 48h a week; 10h rest.",
  },
  {
    key: "shifts_leave", modules: ["shifts"], gates: ["swap_leave_rules"], visibility: "internal",
    topic_vi: "Chính sách nghỉ phép và đổi ca", topic_en: "Leave and shift-swap policy",
    hint_vi: "Xin nghỉ trước bao lâu, ai duyệt, số ngày phép, quy tắc đổi ca. Ví dụ: xin nghỉ trước 3 ngày; 12 ngày phép/năm; đổi ca cần quản lý ca duyệt.", hint_en: "Notice for leave, who approves, leave days, swap rules. E.g. 3 days notice; 12 days a year; swaps need the shift lead's approval.",
  },
  {
    key: "shifts_busy_periods", modules: ["shifts"], gates: ["coverage"], visibility: "internal",
    topic_vi: "Giờ cao điểm và nhân sự tối thiểu", topic_en: "Busy periods and minimum cover",
    hint_vi: "Khung giờ hoặc ngày đông khách và số người tối thiểu để mở cửa. Ví dụ: 11-13h và T7-CN cần tối thiểu 5 người; ca đêm tối thiểu 2.", hint_en: "Busy hours or days and the minimum crew to open. E.g. 11-13h and weekends need 5 people; night shift minimum 2.",
  },
  /* hiring */
  {
    key: "hiring_roles", modules: ["hiring"], gates: ["open_roles", "criteria"], visibility: "public",
    topic_vi: "Mô tả vị trí đang tuyển", topic_en: "Role descriptions",
    hint_vi: "Mỗi vị trí: việc chính, yêu cầu bắt buộc và ưu tiên, địa điểm, hình thức. Ví dụ: Thu ngân, toàn thời gian, quận 1, biết dùng POS, ưu tiên có kinh nghiệm F&B.", hint_en: "Per role: main duties, must-have and nice-to-have, place, type. E.g. Cashier, full time, District 1, POS skills, F&B experience a plus.",
  },
  {
    key: "hiring_process", modules: ["hiring"], gates: ["interview_process", "fairness"], visibility: "internal",
    topic_vi: "Các bước tuyển dụng", topic_en: "Process stages",
    hint_vi: "Từng bước, ai làm, bao lâu, tiêu chí đạt hoặc loại. Ví dụ: lọc hồ sơ (2 ngày), gọi sàng lọc, phỏng vấn với quản lý, làm thử 1 ca, thư mời trong 3 ngày.", hint_en: "Each stage, who runs it, how long, pass criteria. E.g. CV screen (2 days), phone screen, manager interview, trial shift, offer within 3 days.",
  },
  {
    key: "hiring_benefits", modules: ["hiring"], gates: ["offer_rules"], visibility: "internal",
    topic_vi: "Phúc lợi cho ứng viên", topic_en: "Benefits",
    hint_vi: "Quyền lợi được nói với ứng viên: thưởng, bảo hiểm, phép, đào tạo, thử việc. Ví dụ: thử việc 2 tháng hưởng 85% lương; BHXH sau thử việc; thưởng Tết tháng 13.", hint_en: "What candidates can be told: bonus, insurance, leave, training, probation. E.g. 2-month probation at 85%; insurance after probation; 13th-month bonus.",
  },
  {
    key: "hiring_salary_bands", modules: ["hiring"], gates: ["offer_rules", "privacy"], visibility: "internal",
    topic_vi: "Khung lương (hạn chế)", topic_en: "Salary bands (restricted)",
    hint_vi: "Khung lương từng vị trí và mức tối đa được thỏa thuận. Chỉ nội bộ, không đưa cho ứng viên hay khách; nên lưu ở phạm vi Hạn chế trong Bộ não. Ví dụ: Thu ngân 7-9 triệu.", hint_en: "Pay band per role and the negotiation ceiling. Internal only, never shared with candidates or customers; keep it Restricted in the Brain. E.g. Cashier 7-9M.",
  },
  /* content */
  {
    key: "content_pillars", modules: ["content"], gates: ["pillars", "audience"], visibility: "internal",
    topic_vi: "Trụ cột nội dung", topic_en: "Content pillars",
    hint_vi: "3-5 chủ đề cố định, tỷ lệ mỗi loại, đối tượng đọc. Ví dụ: Mẹo dùng (40%), Hậu trường (20%), Khách hàng nói (20%), Khuyến mãi (20%); dành cho mẹ bỉm 25-35 tuổi.", hint_en: "3-5 fixed themes, share of each, target audience. E.g. Tips (40%), Behind the scenes (20%), Customer stories (20%), Offers (20%); aimed at mums 25-35.",
  },
  {
    key: "content_banned_claims", modules: ["content"], gates: ["claims_limits"], visibility: "internal",
    topic_vi: "Điều không được nói", topic_en: "Banned claims",
    hint_vi: "Từ ngữ và cam kết cấm dùng, đối thủ không nhắc tên, quy định ngành. Ví dụ: không nói 'chữa khỏi', 'số 1', 'cam kết 100%'; không so sánh với thương hiệu khác.", hint_en: "Words and promises not allowed, competitors not to name, industry rules. E.g. never 'cures', 'number 1', '100% guaranteed'; no brand comparisons.",
  },
  {
    key: "content_offers_calendar", modules: ["content"], gates: ["cadence"], visibility: "internal",
    topic_vi: "Lịch ưu đãi và sự kiện", topic_en: "Offers and events calendar",
    hint_vi: "Ưu đãi, dịp lễ, sự kiện sắp tới theo ngày kèm điều kiện áp dụng. Ví dụ: 20/10 giảm 15% toàn menu; 11/11 mua 2 tặng 1; khai trương chi nhánh 2 vào 1/12.", hint_en: "Upcoming offers, holidays and events by date with conditions. E.g. 20 Oct 15% off; 11 Nov buy 2 get 1; second branch opens 1 Dec.",
  },
  {
    key: "content_channels_cadence", modules: ["content"], gates: ["channels", "cadence", "approval"], visibility: "internal",
    topic_vi: "Kênh đăng và tần suất", topic_en: "Channels and posting cadence",
    hint_vi: "Đăng ở đâu, bao nhiêu bài mỗi tuần, giờ đăng, bài nào cần bạn duyệt. Ví dụ: Facebook 4 bài/tuần lúc 19h; TikTok 2 video; bài có giá phải duyệt.", hint_en: "Where to post, posts per week, times, what needs your approval. E.g. Facebook 4 a week at 19:00; TikTok 2 videos; posts with prices need approval.",
  },
  /* video */
  {
    key: "video_brand_kit", modules: ["video"], gates: ["brand_assets", "formats"], visibility: "internal",
    topic_vi: "Bộ nhận diện thương hiệu", topic_en: "Brand kit",
    hint_vi: "Logo, màu chủ đạo, phông chữ, nhạc nên và không nên dùng, tỷ lệ khung hình. Ví dụ: màu #0F766E; logo góc phải; video dọc 9:16 dưới 30 giây.", hint_en: "Logo, main colours, fonts, music dos and don'ts, aspect ratios. E.g. colour #0F766E; logo bottom right; vertical 9:16 under 30s.",
  },
  {
    key: "video_offers", modules: ["video"], gates: ["video_goals"], visibility: "public",
    topic_vi: "Ưu đãi và sản phẩm cần đưa vào video", topic_en: "Offers and products to feature",
    hint_vi: "Sản phẩm hoặc ưu đãi ưu tiên quảng bá, thời hạn, câu kêu gọi hành động. Ví dụ: combo trà chiều 99.000đ đến 31/10; CTA: nhắn Zalo để giữ chỗ.", hint_en: "Products or offers to push, their dates, the call to action. E.g. afternoon tea combo 99,000đ until 31 Oct; CTA: message us on Zalo to book.",
  },
  {
    key: "video_claims", modules: ["video"], gates: ["claims_limits", "approval"], visibility: "internal",
    topic_vi: "Giới hạn lời hứa và người duyệt video", topic_en: "Claim limits and video approval",
    hint_vi: "Điều không được hứa trong video, hình ảnh cấm dùng, ai duyệt trước khi đăng. Ví dụ: không hứa 'giảm cân', không dùng ảnh khách khi chưa xin phép; chủ duyệt mọi video.", hint_en: "What a video must not promise, banned imagery, who approves before posting. E.g. no weight-loss promises, no customer photos without consent; owner approves every video.",
  },
  /* lead_gen: gate keys are those of resources/modules/lead_gen/module.json */
  {
    key: "lead_icp", modules: ["lead_gen"], gates: ["icp_area"], visibility: "internal",
    topic_vi: "Khách hàng lý tưởng", topic_en: "Ideal customer",
    hint_vi: "Ai là khách đáng chăm nhất: độ tuổi, nghề, khu vực, ngân sách, vấn đề họ gặp. Ví dụ: chủ quán cà phê 1-3 chi nhánh ở TP.HCM, ngân sách 5-20 triệu/tháng.", hint_en: "Who is worth pursuing: age, job, area, budget, the problem they have. E.g. owners of 1-3 cafés in HCMC, budget 5-20M a month.",
  },
  {
    key: "lead_questions", modules: ["lead_gen"], gates: ["qualification"], visibility: "internal",
    topic_vi: "Câu hỏi sàng lọc khách", topic_en: "Qualification questions",
    hint_vi: "Vài câu hỏi theo thứ tự để hiểu nhu cầu, mỗi lần chỉ hỏi một câu. Ví dụ: Anh/chị quan tâm dịch vụ nào? Ngân sách khoảng bao nhiêu? Cần xong trước ngày nào? Gọi số nào tiện?", hint_en: "A few ordered questions to understand need, one at a time. E.g. Which service? Rough budget? Needed by when? Best number to call?",
  },
  {
    key: "lead_scoring", modules: ["lead_gen"], gates: ["qualification"], visibility: "internal",
    topic_vi: "Tiêu chí khách nóng, ấm, lạnh", topic_en: "Hot, warm and cold criteria",
    hint_vi: "Dấu hiệu từng mức và việc làm tiếp. Ví dụ: Nóng = để lại số và hỏi giá hoặc lịch, gọi trong 15 phút; Ấm = quan tâm nhưng chưa rõ ngân sách, nhắn lại sau 1 ngày; Lạnh = chỉ xem, nuôi bằng nội dung.", hint_en: "Signals for each level and the next step. E.g. Hot = leaves a number and asks price or dates, call within 15 min; Warm = interested, no budget yet, follow up in a day; Cold = browsing, nurture.",
  },
  {
    key: "lead_objections", modules: ["lead_gen"], gates: ["objections"], visibility: "internal",
    topic_vi: "Cách trả lời khi khách do dự", topic_en: "Objection handling",
    hint_vi: "Các lời từ chối hay gặp và câu trả lời bạn muốn dùng. Ví dụ: 'Đắt quá' thì nêu giá trị và gói nhỏ hơn; 'Để suy nghĩ' thì hẹn nhắn lại vào ngày cụ thể.", hint_en: "Common pushbacks and the reply you want. E.g. 'Too expensive': explain value, offer a smaller package; 'Let me think': agree a day to follow up.",
  },
  {
    key: "lead_offers", modules: ["lead_gen"], gates: ["public_offers"], visibility: "public",
    topic_vi: "Ưu đãi và giá công khai", topic_en: "Public offers and prices",
    hint_vi: "Giá và ưu đãi được phép nói công khai, thời hạn, điều kiện. Ví dụ: gói khởi đầu 2.990.000đ; giảm 10% cho 20 khách đầu tháng 10; tư vấn miễn phí.", hint_en: "Prices and offers that may be shared openly, with dates and conditions. E.g. starter pack 2,990,000đ; 10% off for the first 20 customers in October; free consultation.",
  },
  {
    key: "lead_forbidden_claims", modules: ["lead_gen"], gates: ["forbidden_claims"], visibility: "internal",
    topic_vi: "Điều không được hứa với khách", topic_en: "Forbidden claims",
    hint_vi: "Cam kết, so sánh, kết quả không được nói với khách tiềm năng. Ví dụ: không hứa doanh thu tăng bao nhiêu %; không nhắc giá chưa công bố; không chê đối thủ.", hint_en: "Promises, comparisons and results never to state to prospects. E.g. no promised revenue growth; no unpublished prices; no knocking competitors.",
  },
  {
    key: "lead_routing", modules: ["lead_gen"], gates: ["hours_owner"], visibility: "internal",
    topic_vi: "Giờ làm việc và ai nhận khách", topic_en: "Working hours and who receives leads",
    hint_vi: "Khung giờ gọi lại, ai nhận khách nóng, khách ngoài giờ xử lý ra sao. Ví dụ: Hương nhận khách 8-18h; sau 18h hẹn gọi 8h sáng; khách nóng báo Zalo chủ ngay.", hint_en: "Call-back hours, who gets hot leads, what happens out of hours. E.g. Huong takes leads 8-18h; after 18h promise a call at 8am; hot leads ping the owner on Zalo.",
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

/**
 * A ready source can still carry a note in `error` (it is not a failure): the passages have no vectors (search by keyword only), or the
 * facts could not be read. Which one decides the label, so a facts note is never shown as "keyword search only".
 */
export const isKeywordOnlyNote = (note: string): boolean => /vector|từ khóa/i.test(note)
