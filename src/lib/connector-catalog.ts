/**
 * The connector catalog (client-safe): everything the Connections library shows, as data. A connector the app can already set up
 * points at its provider (src/lib/connection-providers.ts, which owns the wizard); a planned one is listed as "soon" so owners can
 * say they want it. Adding the next connector is one entry here (plus its provider when it becomes real): the page never changes.
 */
import { PROVIDERS, type L, type Provider } from "./connection-providers"

export type ConnectorCategory = "payments" | "chat" | "commerce" | "accounting" | "data" | "email" | "productivity" | "automation"
export const CATEGORIES: ReadonlyArray<ConnectorCategory> = ["payments", "chat", "commerce", "accounting", "data", "email", "productivity", "automation"]

/** official: built and proven; early: built from public docs, check the first results; soon: planned, not connectable yet. */
export type ConnectorStatus = "official" | "early" | "soon"

/** Which agents a connector is for ("any": every agent may read it, given access). */
export type ConnectorAudience = "chatbot" | "sales" | "accounting" | "any"

/** Glyph for a connector without its own logo (an IconName of src/ui/leaves/Icon). */
export type ConnectorGlyph = "wallet" | "community" | "cart" | "servers" | "email" | "apps" | "trigger" | "code"

export type CatalogEntry = {
  readonly id: string
  readonly name: L
  readonly category: ConnectorCategory
  readonly status: ConnectorStatus
  readonly blurb: L
  /** What it brings into NIVO, one line. */
  readonly brings: L
  readonly audience: ReadonlyArray<ConnectorAudience>
  /** Extra words people search with (brand spellings, Vietnamese terms). */
  readonly keywords: ReadonlyArray<string>
  /** Higher first in "Popular". */
  readonly popularity: number
  /** Set when the app can set it up today. */
  readonly provider?: Provider
  readonly glyph: ConnectorGlyph
  /** Artwork for a connector that is not a provider yet (a provider's logo comes from PROVIDER_LOGO). */
  readonly logo?: string
}

const real = (
  provider: Provider, category: ConnectorCategory, brings: L, audience: ReadonlyArray<ConnectorAudience>, keywords: ReadonlyArray<string>, popularity: number, glyph: ConnectorGlyph,
): CatalogEntry => {
  const def = PROVIDERS[provider]
  return { id: provider, name: def.title, category, status: def.earlyAccess ? "early" : "official", blurb: def.blurb, brings, audience, keywords, popularity, provider, glyph }
}

const soon = (
  id: string, name: string, category: ConnectorCategory, blurb: L, brings: L, audience: ReadonlyArray<ConnectorAudience>, keywords: ReadonlyArray<string>, popularity: number, glyph: ConnectorGlyph,
): CatalogEntry => ({ id, name: { vi: name, en: name }, category, status: "soon", blurb, brings, audience, keywords, popularity, glyph })

export const CATALOG: ReadonlyArray<CatalogEntry> = [
  real("sepay", "payments", { vi: "Giao dịch tiền vào tài khoản ngân hàng", en: "Incoming bank transfers" }, ["accounting"], ["sepay", "ngân hàng", "chuyển khoản", "bank"], 100, "wallet"),
  real("payos", "payments", { vi: "Đơn đã thanh toán qua payOS", en: "Orders paid through payOS" }, ["accounting"], ["payos", "thanh toán", "qr"], 70, "wallet"),
  real("casso", "payments", { vi: "Giao dịch tiền vào qua Casso", en: "Incoming transfers through Casso" }, ["accounting"], ["casso", "ngân hàng", "bank"], 60, "wallet"),
  real("telegram", "chat", { vi: "Tin nhắn khách gửi bot của bạn", en: "Messages customers send your bot" }, ["chatbot", "sales"], ["telegram", "bot", "tele"], 95, "community"),
  real("zalo_oa", "chat", { vi: "Tin nhắn Zalo Official Account", en: "Zalo Official Account messages" }, ["chatbot", "sales"], ["zalo", "oa", "official account"], 98, "community"),
  real("telegram_user", "chat", { vi: "Tin nhắn các cuộc trò chuyện bạn chọn (chỉ đọc)", en: "Messages of the chats you pick (read only)" }, ["any"], ["telegram", "cá nhân", "personal"], 55, "community"),
  real("database", "data", { vi: "Khách hàng, đơn hàng, sản phẩm từ database của bạn", en: "Customers, orders and products from your database" }, ["any"], ["database", "postgres", "mysql", "sql server", "csdl"], 65, "servers"),
  real("openapi", "data", { vi: "Dữ liệu từ API của bạn; agent gọi API bạn cho phép", en: "Data from your API; agents call the endpoints you allow" }, ["any"], ["api", "swagger", "openapi", "rest", "backend"], 62, "code"),
  real("csv_import", "data", { vi: "File Excel, CSV, link Google Sheets, tài liệu", en: "Excel, CSV, Google Sheets links, documents" }, ["any"], ["excel", "csv", "sheet", "xlsx", "docx", "pdf", "google docs", "nhập"], 90, "apps"),
  real("imap", "email", { vi: "Email đến của hộp thư bạn chọn (chỉ đọc)", en: "Incoming mail of the mailbox you choose (read only)" }, ["any"], ["email", "gmail", "outlook", "imap", "hộp thư"], 75, "email"),
  real("smtp", "email", { vi: "Gửi email bằng chính hộp thư cửa hàng", en: "Send email from your own shop mailbox" }, ["accounting", "sales"], ["email", "smtp", "gửi mail"], 58, "email"),
  real("google", "productivity", { vi: "Ghi đơn hàng vào Google Sheets", en: "Write orders into Google Sheets" }, ["sales"], ["google", "sheets", "trang tính"], 80, "apps"),
  real("webhook", "automation", { vi: "Gửi sự kiện tới n8n, Make, Zapier", en: "Send events to n8n, Make, Zapier" }, ["any"], ["webhook", "n8n", "make", "zapier"], 50, "trigger"),

  soon("facebook", "Facebook Messenger", "chat", { vi: "Tin nhắn fanpage cho Chatbot trả lời.", en: "Fanpage messages for the Chatbot to answer." }, { vi: "Tin nhắn fanpage", en: "Fanpage messages" }, ["chatbot", "sales"], ["facebook", "messenger", "fanpage", "fb"], 97, "community"),
  soon("instagram", "Instagram", "chat", { vi: "Tin nhắn Instagram Direct cho Chatbot.", en: "Instagram Direct messages for the Chatbot." }, { vi: "Tin nhắn Instagram", en: "Instagram messages" }, ["chatbot", "sales"], ["instagram", "ig", "direct"], 70, "community"),
  soon("tiktok_chat", "TikTok", "chat", { vi: "Tin nhắn TikTok cho Chatbot.", en: "TikTok messages for the Chatbot." }, { vi: "Tin nhắn TikTok", en: "TikTok messages" }, ["chatbot"], ["tiktok"], 60, "community"),
  soon("shopee", "Shopee", "commerce", { vi: "Đơn hàng, sản phẩm và tin nhắn người mua trên Shopee.", en: "Shopee orders, products and buyer chat." }, { vi: "Đơn, sản phẩm, chat người mua", en: "Orders, products, buyer chat" }, ["sales", "accounting"], ["shopee", "sàn", "tmđt"], 96, "cart"),
  soon("tiktok_shop", "TikTok Shop", "commerce", { vi: "Đơn hàng và sản phẩm TikTok Shop.", en: "TikTok Shop orders and products." }, { vi: "Đơn và sản phẩm", en: "Orders and products" }, ["sales", "accounting"], ["tiktok shop", "sàn"], 88, "cart"),
  soon("lazada", "Lazada", "commerce", { vi: "Đơn hàng và sản phẩm Lazada.", en: "Lazada orders and products." }, { vi: "Đơn và sản phẩm", en: "Orders and products" }, ["sales", "accounting"], ["lazada", "sàn"], 70, "cart"),
  soon("kiotviet", "KiotViet", "commerce", { vi: "Bán hàng tại cửa hàng: hóa đơn, khách, tồn kho.", en: "In-store sales: invoices, customers, stock." }, { vi: "Hóa đơn bán, khách, tồn kho", en: "Sales, customers, stock" }, ["sales", "accounting"], ["kiotviet", "pos", "bán lẻ"], 85, "cart"),
  soon("sapo", "Sapo", "commerce", { vi: "Đơn đa kênh, khách hàng, tồn kho Sapo.", en: "Sapo omnichannel orders, customers, stock." }, { vi: "Đơn, khách, tồn kho", en: "Orders, customers, stock" }, ["sales", "accounting"], ["sapo", "pos"], 78, "cart"),
  soon("haravan", "Haravan", "commerce", { vi: "Đơn hàng website và tồn kho Haravan.", en: "Haravan web orders and stock." }, { vi: "Đơn và tồn kho", en: "Orders and stock" }, ["sales", "accounting"], ["haravan", "website"], 66, "cart"),
  soon("shopify", "Shopify", "commerce", { vi: "Đơn hàng, khách và sản phẩm Shopify.", en: "Shopify orders, customers and products." }, { vi: "Đơn, khách, sản phẩm", en: "Orders, customers, products" }, ["sales", "accounting"], ["shopify"], 55, "cart"),
  soon("woocommerce", "WooCommerce", "commerce", { vi: "Đơn hàng WordPress WooCommerce.", en: "WordPress WooCommerce orders." }, { vi: "Đơn hàng", en: "Orders" }, ["sales", "accounting"], ["woocommerce", "wordpress"], 45, "cart"),
  soon("misa_amis", "MISA AMIS Kế toán", "accounting", { vi: "Đồng bộ chứng từ và danh mục với MISA.", en: "Sync vouchers and lists with MISA." }, { vi: "Chứng từ, danh mục", en: "Vouchers, lists" }, ["accounting"], ["misa", "amis", "kế toán"], 84, "wallet"),
  soon("misa_meinvoice", "MISA meInvoice", "accounting", { vi: "Phát hành và tra cứu hóa đơn điện tử.", en: "Issue and look up e-invoices." }, { vi: "Hóa đơn điện tử", en: "E-invoices" }, ["accounting"], ["misa", "hóa đơn điện tử", "einvoice"], 80, "wallet"),
  soon("viettel_sinvoice", "Viettel S-Invoice", "accounting", { vi: "Hóa đơn điện tử Viettel.", en: "Viettel e-invoices." }, { vi: "Hóa đơn điện tử", en: "E-invoices" }, ["accounting"], ["viettel", "sinvoice", "hóa đơn"], 62, "wallet"),
  soon("vnpay", "VNPAY", "payments", { vi: "Thanh toán VNPAY-QR và cổng thanh toán.", en: "VNPAY-QR and payment gateway." }, { vi: "Giao dịch thanh toán", en: "Payments" }, ["accounting"], ["vnpay", "qr"], 64, "wallet"),
  soon("momo", "MoMo", "payments", { vi: "Thanh toán ví MoMo.", en: "MoMo wallet payments." }, { vi: "Giao dịch ví", en: "Wallet payments" }, ["accounting"], ["momo", "ví"], 63, "wallet"),
  soon("ghn", "Giao Hàng Nhanh", "commerce", { vi: "Trạng thái vận đơn GHN.", en: "GHN shipment status." }, { vi: "Vận đơn", en: "Shipments" }, ["sales"], ["ghn", "giao hàng", "vận chuyển"], 58, "cart"),
  soon("ghtk", "Giao Hàng Tiết Kiệm", "commerce", { vi: "Trạng thái vận đơn GHTK.", en: "GHTK shipment status." }, { vi: "Vận đơn", en: "Shipments" }, ["sales"], ["ghtk", "giao hàng"], 57, "cart"),
  { ...soon("google_calendar", "Google Calendar", "productivity", { vi: "Lịch hẹn cho Đặt lịch.", en: "Appointments for Booking." }, { vi: "Lịch hẹn", en: "Appointments" }, ["any"], ["calendar", "lịch"], 52, "apps"), logo: "/logos/connectors/calendar.svg" },
  { ...soon("google_drive", "Google Drive", "productivity", { vi: "Tài liệu trong thư mục bạn chọn.", en: "Documents in the folder you pick." }, { vi: "Tài liệu", en: "Documents" }, ["any"], ["drive", "tài liệu"], 61, "apps"), logo: "/logos/connectors/google_drive_generic.svg" },
  { ...soon("notion", "Notion", "productivity", { vi: "Trang và database Notion làm tri thức.", en: "Notion pages and databases as knowledge." }, { vi: "Tri thức", en: "Knowledge" }, ["any"], ["notion"], 50, "apps"), logo: "/logos/connectors/notion_generic.svg" },
  { ...soon("slack", "Slack", "productivity", { vi: "Nhận thông báo và duyệt việc trong Slack.", en: "Notices and approvals in Slack." }, { vi: "Thông báo, duyệt", en: "Notices, approvals" }, ["any"], ["slack"], 40, "apps"), logo: "/logos/connectors/slack_generic.svg" },
  { ...soon("airtable", "Airtable", "data", { vi: "Bảng Airtable làm nguồn dữ liệu.", en: "Airtable bases as a data source." }, { vi: "Bảng dữ liệu", en: "Tables" }, ["any"], ["airtable"], 38, "servers"), logo: "/logos/connectors/airtable_generic.svg" },
]

export const entryById = (id: string): CatalogEntry | undefined => CATALOG.find((e) => e.id === id)
export const entryForProvider = (p: Provider): CatalogEntry | undefined => CATALOG.find((e) => e.provider === p)

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()

/** Matches a search (accents ignored, any word), a category and an agent filter. */
export const matches = (e: CatalogEntry, q: { readonly text: string; readonly category: ConnectorCategory | "all"; readonly audience: ConnectorAudience | "all" }): boolean => {
  if (q.category !== "all" && e.category !== q.category) return false
  if (q.audience !== "all" && !e.audience.includes(q.audience) && !e.audience.includes("any")) return false
  const words = fold(q.text).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fold([e.name.vi, e.name.en, e.blurb.vi, e.blurb.en, ...e.keywords].join(" "))
  return words.every((w) => hay.includes(w))
}
