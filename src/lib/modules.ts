import type { ModuleKey } from "./types";
import type { Locale } from "@/i18n/core";

/** Interface copy of one module in one language. */
export type ModuleCopy = {
  summary: string;
  capabilities: string[];
  defaultRole: string;
  defaultInstructions: string;
};

/**
 * The NIVO module catalog. Sales and Accounting come with every workspace; the Chatbot is the module a
 * business buys to capture leads from its website. `available` = can be bought/added from the catalog.
 * `defaultRole` / `defaultInstructions` mirror the English copy and are the server-side fallbacks; the screens
 * read the reader's language through `moduleCopy`.
 */
export type ModuleSpec = {
  key: ModuleKey;
  name: string;
  copy: Record<Locale, ModuleCopy>;
  available: boolean;
  includedWithWorkspace: boolean;
  defaultRole: string;
  defaultInstructions: string;
};

const CHATBOT: Record<Locale, ModuleCopy> = {
  en: {
    summary: "Answers customers on your website day and night, captures every lead with context and hands it to Sales.",
    capabilities: ["Answers from your business knowledge", "Captures leads with their needs", "Hands every lead to Sales", "Never promises price or dates"],
    defaultRole: "Customer enquiries & lead capture",
    defaultInstructions:
      "Greet the customer and understand what they need. Answer only from the business knowledge. When the customer shares a need, ask for their name and company, then capture them as a lead. Never promise price, schedule or scope: say a team member will confirm.",
  },
  vi: {
    summary: "Trả lời khách trên website cả ngày lẫn đêm, ghi nhận từng khách hàng tiềm năng kèm nhu cầu và chuyển cho Sales.",
    capabilities: ["Trả lời theo kiến thức doanh nghiệp của bạn", "Ghi nhận khách hàng cùng nhu cầu", "Chuyển mọi khách hàng cho Sales", "Không hứa giá hay thời hạn"],
    defaultRole: "Tiếp nhận yêu cầu và ghi nhận khách hàng",
    defaultInstructions:
      "Chào khách và tìm hiểu khách cần gì. Chỉ trả lời dựa trên kiến thức doanh nghiệp. Khi khách chia sẻ nhu cầu, hỏi tên và công ty rồi ghi nhận khách hàng. Không hứa giá, lịch hay phạm vi công việc: nói rằng một thành viên trong nhóm sẽ xác nhận.",
  },
};

const SALES: Record<Locale, ModuleCopy> = {
  en: {
    summary: "Follows up every lead, proposes the next step and drafts messages for your approval.",
    capabilities: ["Owns each new lead", "Drafts follow-ups for approval", "Hands won deals to Accounting"],
    defaultRole: "Lead follow-up & proposals",
    defaultInstructions: "",
  },
  vi: {
    summary: "Theo dõi từng khách hàng, đề xuất bước tiếp theo và soạn tin nhắn để bạn duyệt.",
    capabilities: ["Phụ trách mọi khách hàng mới", "Soạn bản nháp theo dõi để bạn duyệt", "Chuyển deal đã chốt cho Accounting"],
    defaultRole: "Theo dõi khách hàng và soạn đề xuất",
    defaultInstructions: "",
  },
};

const ACCOUNTING: Record<Locale, ModuleCopy> = {
  en: {
    summary: "Turns won deals into invoice drafts and reminds you what customers owe.",
    capabilities: ["Invoice drafts from the agreed scope", "Payment reminders", "Receives won deals from Sales"],
    defaultRole: "Invoices & receivables",
    defaultInstructions: "",
  },
  vi: {
    summary: "Biến deal đã chốt thành bản nháp hóa đơn và nhắc bạn khoản khách còn nợ.",
    capabilities: ["Bản nháp hóa đơn theo phạm vi đã thống nhất", "Nhắc thanh toán", "Nhận deal đã chốt từ Sales"],
    defaultRole: "Hóa đơn và công nợ",
    defaultInstructions: "",
  },
};

export const MODULES: ModuleSpec[] = [
  { key: "chatbot", name: "Chatbot", copy: CHATBOT, available: true, includedWithWorkspace: false, defaultRole: CHATBOT.en.defaultRole, defaultInstructions: CHATBOT.en.defaultInstructions },
  { key: "sales", name: "Sales", copy: SALES, available: false, includedWithWorkspace: true, defaultRole: SALES.en.defaultRole, defaultInstructions: SALES.en.defaultInstructions },
  { key: "accounting", name: "Accounting", copy: ACCOUNTING, available: false, includedWithWorkspace: true, defaultRole: ACCOUNTING.en.defaultRole, defaultInstructions: ACCOUNTING.en.defaultInstructions },
];

export const moduleSpec = (key: ModuleKey) => MODULES.find((m) => m.key === key) ?? MODULES[0];

/** The module's interface copy in the reader's language. */
export const moduleCopy = (spec: ModuleSpec, locale: Locale): ModuleCopy => spec.copy[locale];
