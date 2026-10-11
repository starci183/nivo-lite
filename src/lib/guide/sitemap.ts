/**
 * The NIVO guide's map of the console: every place the assistant may send someone, what it is for, how to do the common task there,
 * and the words people use for it. Client-safe data. The guide only ever links to an entry of this map (never a URL a model made up),
 * and `managerOnly` entries are never offered to staff. `target` names the element marked `data-guide="<target>"` that is highlighted
 * after the jump.
 */

export type GuideLocale = "vi" | "en";
type L = { readonly vi: string; readonly en: string };

export type GuidePage = {
  readonly id: string;
  readonly path: string;
  readonly title: L;
  readonly what: L;
  /** The common task on this page, as short imperative steps. */
  readonly steps: { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> };
  /** Lower-case phrases (Vietnamese with or without accents, and English) a person may use for this place. */
  readonly keywords: ReadonlyArray<string>;
  readonly managerOnly?: boolean;
  readonly target?: string;
};

const connection = (provider: string, title: L, what: L, steps: GuidePage["steps"], keywords: ReadonlyArray<string>): GuidePage => ({
  id: `connections.${provider}`, path: "/connections", title, what, steps, keywords, managerOnly: true, target: `connections.${provider}`,
});

export const GUIDE_PAGES: ReadonlyArray<GuidePage> = [
  {
    id: "office", path: "/chat",
    title: { vi: "Office", en: "Office" },
    what: { vi: "Phòng làm việc chung: nhắn với đội và các agent AI, duyệt việc AI đề xuất.", en: "The shared office: talk to your team and AI agents, approve what the AI proposes." },
    steps: { vi: ["Mở Office", "Gõ @tên-agent để gọi agent", "Duyệt hoặc sửa các thẻ chờ duyệt"], en: ["Open Office", "Type @agent-name to call an agent", "Approve or edit the cards waiting for you"] },
    keywords: ["office", "van phong", "nhan tin noi bo", "chat noi bo", "duyet", "phe duyet", "cho duyet", "approve", "giao viec cho ai", "goi agent", "@nivo", "duyet viec", "approve work", "ai proposed"],
  },
  {
    id: "overview", path: "/dashboard",
    title: { vi: "Tổng quan", en: "Overview" },
    what: { vi: "Bức tranh chung: kết quả, việc đang chờ, ngoại lệ cần chú ý.", en: "The big picture: results, waiting work, exceptions to look at." },
    steps: { vi: ["Mở Tổng quan", "Xem các thẻ kết quả và việc chờ"], en: ["Open Overview", "Read the result and waiting-work cards"] },
    keywords: ["tong quan", "dashboard", "bao cao", "ket qua", "doanh thu", "tinh hinh", "overview", "report"],
  },
  {
    id: "authority", path: "/authority",
    title: { vi: "Giao quyền", en: "Authority" },
    what: { vi: "Đặt mục tiêu, chính sách, giọng văn và việc nào AI được tự làm, việc nào phải hỏi bạn.", en: "Set goals, policies, tone, and which actions the AI may do alone or must ask about." },
    steps: { vi: ["Mở Giao quyền", "Chọn từng việc: Tự làm, Hỏi tôi hoặc Không làm", "Đặt giới hạn số tiền nếu cần", "Bấm Lưu"], en: ["Open Authority", "Set each action to Auto, Ask me or Never", "Set an amount limit if needed", "Save"] },
    keywords: ["giao quyen", "quyen han", "tu dong lam", "hoi toi", "chinh sach", "giong van", "muc tieu", "gioi han tien", "authority", "policy"],
  },
  {
    id: "inbox", path: "/inbox",
    title: { vi: "Đầu vào", en: "Inbox" },
    what: { vi: "Mọi thứ đi vào: tin nhắn khách, đơn, giao dịch ngân hàng, từ mọi kênh.", en: "Everything coming in: customer messages, orders, bank transactions, from every channel." },
    steps: { vi: ["Mở Đầu vào", "Lọc theo kênh hoặc loại"], en: ["Open Inbox", "Filter by channel or kind"] },
    keywords: ["dau vao", "inbox", "tin nhan den", "tin nhan khach", "giao dich den", "don moi", "hop thu"],
  },
  {
    id: "leads", path: "/leads",
    title: { vi: "Khách hàng", en: "Customers" },
    what: { vi: "Danh sách khách và cơ hội bán hàng, ai phụ trách và việc tiếp theo.", en: "Customers and sales leads, who owns each, and the next step." },
    steps: { vi: ["Mở Khách hàng", "Bấm Tạo mới › Khách hàng mới để thêm", "Mở một khách để xem lịch sử và giao việc"], en: ["Open Customers", "Press New › New customer to add one", "Open a customer to see history and assign work"] },
    keywords: ["khach hang", "lead", "them khach", "danh sach khach", "co hoi ban hang", "customer", "crm", "new customer", "add a customer", "add customer"],
  },
  {
    id: "responsibilities", path: "/responsibilities",
    title: { vi: "Trách nhiệm", en: "Responsibilities" },
    what: { vi: "Ai đang chịu trách nhiệm việc gì, hạn chót và bước tiếp theo.", en: "Who owns which piece of work, due dates and next steps." },
    steps: { vi: ["Mở Trách nhiệm", "Lọc theo người phụ trách hoặc trạng thái"], en: ["Open Responsibilities", "Filter by owner or status"] },
    keywords: ["trach nhiem", "ai lam gi", "viec cua ai", "han chot", "phu trach", "responsibility", "task"],
  },
  {
    id: "decisions", path: "/decisions",
    title: { vi: "Lịch sử quyết định", en: "Decisions" },
    what: { vi: "Nhật ký mọi quyết định: AI tự làm, người duyệt, người sửa, kèm lý do.", en: "A log of every decision: done by the AI, approved or edited by a person, with reasons." },
    steps: { vi: ["Mở Lịch sử quyết định", "Lọc theo bộ phận hoặc người quyết định"], en: ["Open Decisions", "Filter by department or decider"] },
    keywords: ["lich su quyet dinh", "quyet dinh", "nhat ky", "ai da duyet", "decision", "audit"],
  },
  {
    id: "automations", path: "/automations", managerOnly: true,
    title: { vi: "Tự động hoá", en: "Automations" },
    what: { vi: "Quy trình tự chạy theo lịch hoặc sự kiện: nhắc nợ, báo cáo, chăm sóc khách.", en: "Workflows that run on a schedule or event: payment reminders, reports, customer care." },
    steps: { vi: ["Mở Tự động hoá", "Chọn một mẫu có sẵn hoặc tạo mới", "Bật quy trình"], en: ["Open Automations", "Pick a template or create one", "Turn it on"] },
    keywords: ["tu dong hoa", "tu dong", "quy trinh", "lich chay", "nhac no", "bao cao tu dong", "automation", "workflow", "n8n"],
  },
  {
    id: "knowledge", path: "/knowledge", managerOnly: true,
    title: { vi: "Tri thức", en: "Knowledge" },
    what: { vi: "Dạy AI về doanh nghiệp: bảng giá, chính sách, câu hỏi thường gặp, tài liệu, link.", en: "Teach the AI about your business: prices, policies, FAQs, documents, links." },
    steps: { vi: ["Mở Tri thức", "Bấm Thêm nguồn", "Dán nội dung, tải tệp hoặc dán link", "Lưu để AI dùng khi trả lời"], en: ["Open Knowledge", "Press Add source", "Paste text, upload a file or a link", "Save so the AI uses it"] },
    keywords: ["tri thuc", "kien thuc", "day ai", "bang gia", "price list", "teach the ai", "faq", "cau hoi thuong gap", "tai lieu", "knowledge"],
  },
  {
    id: "brain", path: "/brain",
    title: { vi: "Bộ não", en: "Brain" },
    what: { vi: "Những gì doanh nghiệp biết (giá, giờ mở cửa, chính sách, khách...) ở một chỗ; mỗi agent đọc theo góc nhìn riêng. Duyệt đề xuất và mâu thuẫn ở đây.", en: "What the business knows (prices, hours, policies, customers...) in one place; each agent reads its own view. Review proposals and conflicts here." },
    steps: { vi: ["Mở Bộ não", "Xem tab Cần duyệt: áp dụng hoặc từ chối theo gợi ý của NIVO", "Tab Sự thật: Thêm sự thật hoặc Giá trị mới"], en: ["Open Brain", "Check To review: apply or reject as NIVO suggests", "Facts tab: Add fact or New value"] },
    keywords: ["bo nao", "second brain", "su that", "mau thuan", "agent nho", "ghi nho", "doi gia", "gia moi", "agent biet gi", "bai hoc", "brain", "memory"],
  },
  {
    id: "modules", path: "/m", managerOnly: true,
    title: { vi: "Module", en: "Modules" },
    what: { vi: "Cài và cấu hình các agent: Chatbot, Bán hàng, Kế toán, Đặt lịch, Kho, Tuyển dụng…", en: "Install and set up agents: Chatbot, Sales, Accounting, Booking, Inventory, Hiring…" },
    steps: { vi: ["Mở Module", "Chọn module cần dùng và bấm Cài", "Làm theo các bước thiết lập"], en: ["Open Modules", "Pick a module and install it", "Follow the setup steps"] },
    keywords: ["module", "cai dat agent", "cai chatbot", "chatbot", "ban hang", "ke toan", "dat lich", "kho", "tuyen dung", "agent"],
  },
  {
    id: "team", path: "/team", managerOnly: true, target: "team.invite",
    title: { vi: "Đội ngũ", en: "Team" },
    what: { vi: "Mời người vào workspace và chọn vai trò: Chủ sở hữu, Quản lý, Nhân viên.", en: "Invite people to the workspace and choose their role: Owner, Manager, Staff." },
    steps: { vi: ["Mở Đội ngũ", "Bấm Mời thành viên", "Nhập email và chọn vai trò", "Gửi lời mời hoặc sao chép link mời"], en: ["Open Team", "Press Invite member", "Enter the email and role", "Send the invite or copy the link"] },
    keywords: ["doi ngu", "moi nhan vien", "them nhan vien", "moi thanh vien", "phan quyen", "vai tro", "team", "invite", "invite my staff", "add staff", "my staff"],
  },
  {
    id: "connections", path: "/connections", managerOnly: true,
    title: { vi: "Kết nối", en: "Connections" },
    what: { vi: "Nối NIVO với ngân hàng, Telegram, Zalo OA, email, Google Sheets, n8n.", en: "Connect NIVO to your bank, Telegram, Zalo OA, email, Google Sheets, n8n." },
    steps: { vi: ["Mở Kết nối", "Chọn dịch vụ và bấm Thêm kết nối", "Làm theo hướng dẫn từng bước"], en: ["Open Connections", "Pick a service and press Add connection", "Follow the steps"] },
    keywords: ["ket noi", "tich hop", "connection", "integration"],
  },
  connection("sepay",
    { vi: "Kết nối SePay (tiền về)", en: "SePay bank feed" },
    { vi: "Tiền vào tài khoản ngân hàng được báo cho agent Kế toán để đối soát.", en: "Money arriving in your bank account reaches the Accounting agent for matching." },
    { vi: ["Mở Kết nối › Nguồn tiền về (SePay) › Thêm kết nối", "Chọn Thử nghiệm trước, nhập ngân hàng và số tài khoản", "Dán URL nhận webhook và API Key sang trang Webhook của SePay", "Mô phỏng một giao dịch 2.000đ để kiểm tra"], en: ["Open Connections › SePay › Add connection", "Start in Test mode, enter the bank and account", "Paste the webhook URL and API key into SePay's Webhook page", "Simulate a 2,000 VND transfer to check"] },
    ["sepay", "tien ve", "bao tien ve", "co tien ve", "tien vao", "nhan tien", "chuyen khoan", "ngan hang", "doi soat", "bank", "webhook ngan hang", "money arrives", "payment notification", "incoming money"]),
  connection("telegram",
    { vi: "Kết nối bot Telegram", en: "Telegram bot" },
    { vi: "Khách nhắn bot Telegram của bạn, agent Chatbot trả lời.", en: "Customers message your Telegram bot and the Chatbot agent answers." },
    { vi: ["Nhắn /newbot cho @BotFather để lấy token", "Mở Kết nối › Bot Telegram › Thêm kết nối", "Dán token, NIVO tự đăng ký webhook", "Nhắn thử bot một tin"], en: ["Message /newbot to @BotFather for a token", "Open Connections › Telegram bot › Add connection", "Paste the token; NIVO registers the webhook", "Send the bot a test message"] },
    ["telegram", "bot telegram", "botfather", "token bot", "bot tra loi khach", "bot answer", "answer customers"]),
  connection("zalo_oa",
    { vi: "Kết nối Zalo OA", en: "Zalo OA" },
    { vi: "Khách nhắn Zalo Official Account của cửa hàng, agent Chatbot trả lời.", en: "Customers message your Zalo Official Account and the Chatbot agent answers." },
    { vi: ["Tạo ứng dụng ở developers.zalo.me, lấy App ID và App Secret", "Mở Kết nối › Zalo OA › Thêm kết nối và dán vào", "Dán Callback URL và Webhook URL sang Zalo, bật sự kiện tin nhắn", "Bấm Kết nối Zalo OA để chủ OA đồng ý"], en: ["Create an app at developers.zalo.me for the App ID and secret", "Open Connections › Zalo OA › Add connection and paste them", "Paste the callback and webhook URLs into Zalo, enable message events", "Press Connect Zalo OA so the OA owner consents"] },
    ["zalo", "zalo oa", "official account", "oa"]),
  connection("smtp",
    { vi: "Email gửi đi", en: "Outgoing email" },
    { vi: "Gửi báo cáo, biên nhận, nhắc nợ bằng email của chính cửa hàng.", en: "Send reports, receipts and reminders from your own shop email." },
    { vi: ["Mở Kết nối › Email gửi đi › Thêm kết nối", "Nhập máy chủ SMTP hoặc chọn nhà cung cấp", "Gửi thử một email"], en: ["Open Connections › Outgoing email › Add connection", "Enter the SMTP server or pick a provider", "Send a test email"] },
    ["email", "smtp", "gui email", "gmail", "thu dien tu"]),
  connection("google",
    { vi: "Google Sheets", en: "Google Sheets" },
    { vi: "NIVO ghi đơn hàng vào bảng tính Google của bạn.", en: "NIVO records orders in your Google spreadsheet." },
    { vi: ["Mở Kết nối › Google (Sheets) › Thêm kết nối", "Đăng nhập Google và cho phép", "Chọn bảng tính"], en: ["Open Connections › Google (Sheets) › Add connection", "Sign in to Google and allow access", "Pick the spreadsheet"] },
    ["google sheet", "google sheets", "bang tinh", "excel", "spreadsheet"]),
  connection("webhook",
    { vi: "n8n / Webhook", en: "n8n / Webhook" },
    { vi: "Gửi sự kiện (khách mới, chốt đơn, nhận tiền) sang n8n, Make, Zapier.", en: "Send events (new customer, order, payment) to n8n, Make or Zapier." },
    { vi: ["Mở Kết nối › n8n / Webhook › Thêm kết nối", "Dán URL webhook của n8n", "Chọn sự kiện cần gửi và gửi thử"], en: ["Open Connections › n8n / Webhook › Add connection", "Paste the n8n webhook URL", "Pick events and send a test"] },
    ["n8n", "webhook", "zapier", "make.com", "make"]),
  {
    id: "developers", path: "/developers", managerOnly: true,
    title: { vi: "Nhà phát triển (API)", en: "Developers (API)" },
    what: { vi: "Tạo khóa API để phần mềm khác đọc và ghi dữ liệu NIVO.", en: "Create API keys so other software can read and write NIVO data." },
    steps: { vi: ["Mở Nhà phát triển", "Đặt tên khóa và bấm Tạo", "Sao chép khóa ngay, NIVO chỉ hiện một lần"], en: ["Open Developers", "Name the key and create it", "Copy it now; it is shown once"] },
    keywords: ["api", "khoa api", "api key", "developer", "lap trinh"],
  },
  {
    id: "billing", path: "/billing", managerOnly: true,
    title: { vi: "Credit và gói", en: "Credits and plan" },
    what: { vi: "Credit AI đã dùng và còn lại, nạp thêm credit, nâng cấp gói và lịch sử thanh toán.", en: "AI credits used and left, top-ups, plan upgrades and payment history." },
    steps: { vi: ["Mở Credit & gói", "Xem credit tháng này và dự báo hết", "Bấm Mua để nạp thêm hoặc Nâng cấp để đổi gói"], en: ["Open Credits & plan", "Check this month's credits and the run-out forecast", "Buy a pack to top up, or upgrade the plan"] },
    keywords: ["thanh toan", "goi cuoc", "nang cap", "gia han", "hoa don nivo", "han muc ai", "billing", "plan", "upgrade", "credit", "nap them credit", "het credit", "top up", "topup"],
  },
  {
    id: "account", path: "/account",
    title: { vi: "Tài khoản của bạn", en: "Your account" },
    what: { vi: "Đổi tên hiển thị, email, mật khẩu và đăng xuất các thiết bị khác.", en: "Change your name, email, password and sign out other devices." },
    steps: { vi: ["Mở menu ảnh đại diện › Tài khoản", "Sửa thông tin và bấm Lưu"], en: ["Open the avatar menu › Account", "Edit and save"] },
    keywords: ["tai khoan cua toi", "thong tin tai khoan", "doi mat khau", "mat khau", "ten hien thi", "dang xuat", "thiet bi dang nhap", "my account", "password", "change my password", "change password"],
  },
];

export const guidePage = (id: string): GuidePage | undefined => GUIDE_PAGES.find((p) => p.id === id);

/** The pages a member with this role may be sent to. */
export const pagesFor = (isManager: boolean): ReadonlyArray<GuidePage> => GUIDE_PAGES.filter((p) => isManager || !p.managerOnly);

/** The map entry whose path is the start of `pathname` (longest wins), for "you are here". */
export const pageAt = (pathname: string): GuidePage | undefined =>
  [...GUIDE_PAGES].filter((p) => !p.target || p.id === "team").sort((a, b) => b.path.length - a.path.length).find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
