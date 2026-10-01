/**
 * Client-safe registry of the connection providers and the guided steps that mirror each provider's own screens.
 * A new bank/payment provider is DATA here plus one webhook route (src/app/api/connections/<id>/[connectionId]/route.ts) that feeds
 * `feedCredit` (src/lib/connection-events.ts). Labels that sit on the provider's own screen (field names, option names) are written
 * exactly as the provider prints them and are not translated; only the explanations carry {vi, en}.
 */
export type Provider = "telegram" | "sepay" | "zalo_oa" | "payos" | "casso";
export type Environment = "test" | "live";
export type L = { readonly vi: string; readonly en: string };
export type Locale = keyof L;

/** What the wizard knows, to fill into copy values. */
export type GuideContext = { readonly name: string; readonly webhookUrl: string; readonly apiKey: string; readonly bank: string; readonly account: string };
export type Token = "webhookName" | "webhookUrl" | "apiKey";

/** One line of a provider screen: copy a value, make a choice, switch something on, paste a provider value into NIVO, or a plain note. */
export type GuideItem =
  | { readonly kind: "copy"; readonly label: string; readonly token: Token; readonly secret?: boolean }
  | { readonly kind: "choose"; readonly label: string; readonly option: string }
  | { readonly kind: "switch"; readonly label: string; readonly state: L }
  | { readonly kind: "paste"; readonly label: string; readonly field: string; readonly secret?: boolean; readonly hint?: L }
  | { readonly kind: "note"; readonly text: L };

export type GuideStep = { readonly id: string; readonly title: string; readonly items: ReadonlyArray<GuideItem> };
export type VerifyHelp = { readonly intro: L; readonly steps: ReadonlyArray<L>; readonly url?: string };

export type ProviderDef = {
  readonly id: Provider;
  readonly kind: "money" | "telegram" | "zalo";
  readonly title: L;
  /** The provider's own brand name, as in "Mở trang X" and "Làm theo trên X". */
  readonly brand: string;
  readonly blurb: L;
  readonly module: "accounting" | "chatbot" | null;
  /** True when the docs could not be fully confirmed: shown as "Thử nghiệm sớm". */
  readonly earlyAccess?: boolean;
  readonly environments: ReadonlyArray<Environment>;
  /** Said honestly in the environment step when the provider has no test mode. */
  readonly noTestNote?: L;
  readonly needsBank: boolean;
  readonly dashboard: Partial<Record<Environment, string>>;
  readonly guide: ReadonlyArray<GuideStep>;
  /** Provider values NIVO needs (pasted by the owner in the guide) and stores encrypted. */
  readonly credentials: ReadonlyArray<string>;
  /** After saving credentials NIVO asks this provider to confirm the webhook URL itself. */
  readonly confirmsWebhook?: boolean;
  readonly verify: Partial<Record<Environment, VerifyHelp>>;
};

const SMALL_TRANSFER: L = {
  vi: "Chuyển một khoản nhỏ, ví dụ 2.000đ, vào đúng tài khoản {bank} · {account} từ một ngân hàng hoặc ví khác.",
  en: "Transfer a small amount, for example 2,000 VND, into the account {bank} · {account} from another bank or wallet.",
};

export const PROVIDERS: Readonly<Record<Provider, ProviderDef>> = {
  sepay: {
    id: "sepay", kind: "money", title: { vi: "Nguồn tiền về (SePay)", en: "Bank feed (SePay)" }, brand: "SePay",
    blurb: { vi: "Tiền vào tài khoản ngân hàng của bạn được báo cho agent Kế toán để đối soát.", en: "Money arriving in your bank account reaches the Accounting agent for matching." },
    module: "accounting", environments: ["test", "live"], needsBank: true,
    dashboard: { test: "https://my.sepay.vn/testmode/webhook", live: "https://my.sepay.vn/webhook" },
    credentials: [],
    guide: [
      { id: "basic", title: "Cơ bản", items: [
        { kind: "copy", label: "Tên webhook", token: "webhookName" },
        { kind: "copy", label: "URL nhận webhook", token: "webhookUrl" },
        { kind: "choose", label: "Loại giao dịch", option: "Tiền vào" },
        { kind: "choose", label: "Định dạng dữ liệu", option: "JSON" },
        { kind: "switch", label: "Tự động gửi lại khi server trả lỗi", state: { vi: "bật", en: "turn on" } },
      ] },
      { id: "account", title: "Tài khoản", items: [
        { kind: "choose", label: "Tài khoản ngân hàng", option: "{bank} · {account}" },
      ] },
      { id: "security", title: "Bảo mật", items: [
        { kind: "choose", label: "Kiểu xác thực", option: "API Key" },
        { kind: "copy", label: "API Key", token: "apiKey", secret: true },
        { kind: "note", text: { vi: "Các bước còn lại để mặc định, rồi bấm Lưu.", en: "Leave the remaining steps as they are, then press Save." } },
      ] },
    ],
    verify: {
      test: {
        url: "https://my.sepay.vn/testmode/webhook",
        intro: { vi: "Tiền trong chế độ thử nghiệm không phải tiền thật.", en: "Money in test mode is not real." },
        steps: [
          { vi: "Trên SePay, bật công tắc Test Mode ở góc trên bên phải.", en: "On SePay, turn on the Test Mode switch at the top right." },
          { vi: "Vào Giao dịch và bấm Mô phỏng giao dịch.", en: "Open Transactions and press Simulate transaction." },
          { vi: "Chọn đúng tài khoản {bank} · {account}, nhập 2.000đ rồi tạo giao dịch.", en: "Pick the account {bank} · {account}, enter 2,000 and create the transaction." },
        ],
      },
      live: { intro: { vi: "Một giao dịch thật nhỏ là cách chắc chắn nhất để biết kết nối chạy.", en: "A small real transfer is the surest way to know it works." }, steps: [SMALL_TRANSFER] },
    },
  },
  payos: {
    id: "payos", kind: "money", title: { vi: "Thanh toán qua payOS", en: "payOS payments" }, brand: "payOS", earlyAccess: true,
    blurb: { vi: "Đơn đã thanh toán qua payOS được báo cho agent Kế toán để đối soát.", en: "Orders paid through payOS reach the Accounting agent for matching." },
    module: "accounting", environments: ["live"], needsBank: false,
    noTestNote: { vi: "payOS không có chế độ thử nghiệm riêng mà NIVO biết được, nên chỉ có thể kết nối Chính thức. Hãy thử bằng một khoản nhỏ.", en: "NIVO knows of no separate test mode in payOS, so only Live is available. Try it with a small amount." },
    dashboard: { live: "https://my.payos.vn" },
    credentials: ["clientId", "apiKey", "checksumKey"],
    confirmsWebhook: true,
    guide: [
      { id: "channel", title: "Kênh thanh toán", items: [
        { kind: "choose", label: "Menu", option: "Kênh thanh toán" },
        { kind: "choose", label: "Nút", option: "Tạo kênh thanh toán" },
        { kind: "note", text: { vi: "Đặt tên và chọn tài khoản ngân hàng nhận tiền của bạn trên payOS, rồi tạo kênh.", en: "Name it and pick the bank account that receives your money on payOS, then create the channel." } },
      ] },
      { id: "keys", title: "Khóa của kênh", items: [
        { kind: "paste", label: "Client ID", field: "clientId" },
        { kind: "paste", label: "API Key", field: "apiKey", secret: true },
        { kind: "paste", label: "Checksum Key", field: "checksumKey", secret: true },
      ] },
      { id: "webhook", title: "Webhook", items: [
        { kind: "copy", label: "Webhook URL", token: "webhookUrl" },
        { kind: "note", text: { vi: "NIVO sẽ nhờ payOS xác nhận địa chỉ này khi bạn bấm Lưu khóa. Nếu kênh có ô Webhook URL, bạn cũng có thể dán vào đó.", en: "NIVO asks payOS to confirm this address when you press Save keys. If the channel has a Webhook URL box you can paste it there too." } },
      ] },
    ],
    verify: { live: { intro: { vi: "Một đơn thật nhỏ là cách chắc chắn nhất để biết kết nối chạy.", en: "A small real order is the surest way to know it works." }, steps: [
      { vi: "Tạo một link thanh toán nhỏ, ví dụ 2.000đ, trên payOS.", en: "Create a small payment link, for example 2,000 VND, on payOS." },
      { vi: "Thanh toán link đó bằng ứng dụng ngân hàng.", en: "Pay that link with your banking app." },
    ] } },
  },
  casso: {
    id: "casso", kind: "money", title: { vi: "Nguồn tiền về (Casso)", en: "Bank feed (Casso)" }, brand: "Casso",
    blurb: { vi: "Tiền vào tài khoản ngân hàng được Casso báo cho agent Kế toán để đối soát.", en: "Money arriving in your bank account is relayed by Casso to the Accounting agent for matching." },
    module: "accounting", environments: ["live"], needsBank: true,
    noTestNote: { vi: "Casso không có chế độ thử nghiệm riêng mà NIVO biết được, nên chỉ có thể kết nối Chính thức. Hãy thử bằng một khoản chuyển nhỏ.", en: "NIVO knows of no separate test mode in Casso, so only Live is available. Try it with a small transfer." },
    dashboard: { live: "https://casso.vn" },
    credentials: ["secureKey"],
    guide: [
      { id: "add", title: "Kết nối > Tích hợp", items: [
        { kind: "choose", label: "Nút", option: "Thêm tích hợp" },
        { kind: "choose", label: "Ứng dụng", option: "Webhook V2" },
        { kind: "choose", label: "1. Chọn ngân hàng", option: "{bank} · {account}" },
        { kind: "choose", label: "Nút", option: "Tiếp tục" },
      ] },
      { id: "setup", title: "Thiết lập", items: [
        { kind: "copy", label: "Webhook URL", token: "webhookUrl" },
        { kind: "paste", label: "Key bảo mật", field: "secureKey", secret: true, hint: { vi: "Casso tự tạo khóa này. Sao chép từ Casso và dán vào đây.", en: "Casso generates this key. Copy it from Casso and paste it here." } },
        { kind: "note", text: { vi: "Bấm Lưu trên Casso để hoàn tất tích hợp.", en: "Press Save on Casso to finish the integration." } },
      ] },
    ],
    verify: { live: { intro: { vi: "Một giao dịch thật nhỏ là cách chắc chắn nhất để biết kết nối chạy.", en: "A small real transfer is the surest way to know it works." }, steps: [SMALL_TRANSFER] } },
  },
  telegram: {
    id: "telegram", kind: "telegram", title: { vi: "Bot Telegram", en: "Telegram bot" }, brand: "Telegram",
    blurb: { vi: "Khách nhắn cho bot của chính bạn; agent Chatbot sẽ trả lời họ.", en: "Customers message your own bot; the Chatbot agent answers them." },
    module: "chatbot", environments: ["live"], needsBank: false, dashboard: { live: "https://t.me/BotFather" }, credentials: ["token"], verify: {},
    guide: [
      { id: "botfather", title: "BotFather", items: [
        { kind: "note", text: { vi: "Mở Telegram, tìm @BotFather (tài khoản chính thức, có dấu tích xanh).", en: "Open Telegram and search for @BotFather (the official account with the blue tick)." } },
        { kind: "choose", label: "Gửi tin nhắn", option: "/newbot" },
        { kind: "note", text: { vi: "Đặt tên và username cho bot của cửa hàng (username phải kết thúc bằng bot).", en: "Give your shop's bot a name and a username (the username must end in bot)." } },
        { kind: "note", text: { vi: "BotFather gửi lại một dãy token dài dạng 123456:ABC-DEF... Hãy sao chép toàn bộ.", en: "BotFather replies with a long token like 123456:ABC-DEF... Copy all of it." } },
      ] },
    ],
  },
  zalo_oa: {
    id: "zalo_oa", kind: "zalo", title: { vi: "Zalo OA", en: "Zalo OA" }, brand: "Zalo", module: null,
    blurb: { vi: "Lưu cấu hình Zalo Official Account. Gửi và nhận tin sắp có.", en: "Save your Zalo Official Account settings. Sending and receiving is coming soon." },
    environments: ["live"], needsBank: false, dashboard: { live: "https://oa.zalo.me" }, credentials: [], verify: {},
    guide: [
      { id: "oa", title: "Zalo Official Account", items: [
        { kind: "note", text: { vi: "Mở trang quản lý Zalo OA và ứng dụng Zalo của bạn, rồi sao chép OA ID, App ID, App secret và các token.", en: "Open your Zalo OA management page and Zalo app, then copy the OA ID, App ID, App secret and the tokens." } },
      ] },
    ],
  },
};

/** Order the providers appear on the Connections page. */
export const PROVIDER_ORDER: ReadonlyArray<Provider> = ["sepay", "payos", "casso", "telegram", "zalo_oa"];

/** Replace {name} {bank} {account} in a guide or help string. */
export const fill = (s: string, ctx: Pick<GuideContext, "bank" | "account" | "name">): string =>
  s.replace(/\{(bank|account|name)\}/g, (_, k: "bank" | "account" | "name") => ctx[k]);

export const tokenValue = (t: Token, ctx: GuideContext): string =>
  t === "webhookName" ? `NIVO · ${ctx.name}` : t === "webhookUrl" ? ctx.webhookUrl : ctx.apiKey;
