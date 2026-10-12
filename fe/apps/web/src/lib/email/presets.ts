/**
 * Client-safe registry of the SMTP providers the "Email gửi đi" wizard offers. Each choice prefills host, port and security and carries a
 * short guide written for a non-technical owner. Hosts and steps were checked against each provider's own documentation (see `checked`).
 */
export type L = { readonly vi: string; readonly en: string };
export type Security = "starttls" | "tls";
export type GuideLink = { readonly label: L; readonly url: string };
export type GuideStep = { readonly text: L; readonly link?: GuideLink };

/** One way of sending through a provider: where to connect and how the owner gets the password. */
export type SmtpMode = {
  readonly id: string;
  readonly label: L;
  readonly when: L;
  readonly host: string;
  readonly port: number;
  readonly security: Security;
  /** The owner types the host themselves (hosting, SES region). */
  readonly hostEditable?: boolean;
  /** A fixed username (Resend, SendGrid) the owner does not have to know. */
  readonly fixedUser?: string;
  /** The username is the sender mailbox (Gmail, Microsoft 365, Zoho). */
  readonly userIsEmail?: boolean;
  readonly passwordLabel: L;
  readonly passwordHint: L;
  readonly steps: ReadonlyArray<GuideStep>;
  readonly cautions: ReadonlyArray<L>;
};

export type SmtpPreset = {
  readonly id: "google_workspace" | "gmail" | "microsoft365" | "zoho" | "vn_hosting" | "relay_service";
  readonly title: L;
  readonly blurb: L;
  readonly modes: ReadonlyArray<SmtpMode>;
};

const APP_PASSWORD_LABEL: L = { vi: "Mật khẩu ứng dụng (16 ký tự)", en: "App password (16 characters)" };
const APP_PASSWORD_HINT: L = { vi: "Dán 16 ký tự Google đã tạo, có hay không có dấu cách đều được.", en: "Paste the 16 characters Google created, with or without spaces." };
const APP_PASSWORD_STEPS: ReadonlyArray<GuideStep> = [
  { text: { vi: "Bật Xác minh 2 bước cho tài khoản Google (bắt buộc mới tạo được mật khẩu ứng dụng).", en: "Turn on 2-Step Verification for the Google account (required to create an app password)." }, link: { label: { vi: "Mở Xác minh 2 bước", en: "Open 2-Step Verification" }, url: "https://myaccount.google.com/signinoptions/twosv" } },
  { text: { vi: "Mở trang Mật khẩu ứng dụng, đặt tên là NIVO rồi bấm Tạo.", en: "Open App passwords, name it NIVO and press Create." }, link: { label: { vi: "Mở Mật khẩu ứng dụng", en: "Open App passwords" }, url: "https://myaccount.google.com/apppasswords" } },
  { text: { vi: "Google hiện 16 ký tự. Sao chép và dán vào ô Mật khẩu ở bước sau. Google chỉ hiện một lần.", en: "Google shows 16 characters. Copy them and paste into the Password box on the next step. Google shows them only once." } },
];

export const SMTP_PRESETS: ReadonlyArray<SmtpPreset> = [
  {
    id: "google_workspace",
    title: { vi: "Google Workspace (email theo tên miền công ty)", en: "Google Workspace (company-domain email)" },
    blurb: { vi: "Email dạng ten@congty.vn chạy trên Google.", en: "Email like name@company.com hosted by Google." },
    modes: [
      {
        id: "app_password", label: { vi: "Mật khẩu ứng dụng (khuyên dùng)", en: "App password (recommended)" },
        when: { vi: "Chọn cách này nếu bạn là chủ shop và không phải quản trị viên Google Workspace. Làm được trong 2 phút.", en: "Choose this if you are the shop owner and not a Google Workspace admin. Takes about 2 minutes." },
        host: "smtp.gmail.com", port: 587, security: "starttls", userIsEmail: true,
        passwordLabel: APP_PASSWORD_LABEL, passwordHint: APP_PASSWORD_HINT,
        steps: [
          ...APP_PASSWORD_STEPS,
          { text: { vi: "Nếu không thấy mục Mật khẩu ứng dụng, quản trị viên Workspace của bạn đã tắt nó. Nhờ họ bật, hoặc chọn cách Dịch vụ chuyển tiếp SMTP.", en: "If App passwords is missing, your Workspace admin has turned it off. Ask them to allow it, or use the SMTP relay mode." } },
        ],
        cautions: [{ vi: "Giới hạn gửi của Google Workspace khoảng 2.000 email mỗi ngày cho mỗi người dùng.", en: "Google Workspace allows about 2,000 emails per day per user." }],
      },
      {
        id: "relay", label: { vi: "Dịch vụ chuyển tiếp SMTP của Google (cho quản trị viên)", en: "Google SMTP relay service (for admins)" },
        when: { vi: "Chọn cách này chỉ khi bạn là quản trị viên Workspace và máy chủ gửi có địa chỉ IP cố định. NIVO chạy trên máy chủ dùng chung nên thường KHÔNG hợp với cách này; nếu không chắc, hãy chọn Mật khẩu ứng dụng.", en: "Choose this only if you are a Workspace admin and the sending server has a fixed IP address. NIVO runs on shared servers, so this usually does NOT fit; if unsure, pick App password." },
        host: "smtp-relay.gmail.com", port: 587, security: "starttls", userIsEmail: true,
        passwordLabel: { vi: "Mật khẩu (để trống nếu xác thực bằng IP)", en: "Password (leave empty if you authenticate by IP)" },
        passwordHint: { vi: "Relay thường xác thực theo địa chỉ IP, không cần mật khẩu.", en: "The relay normally authenticates by IP address and needs no password." },
        steps: [
          { text: { vi: "Vào Google Admin console, mở Ứng dụng > Google Workspace > Gmail > Định tuyến.", en: "In the Google Admin console open Apps > Google Workspace > Gmail > Routing." }, link: { label: { vi: "Mở Admin console", en: "Open Admin console" }, url: "https://admin.google.com" } },
          { text: { vi: "Mục Dịch vụ chuyển tiếp SMTP: bấm Thêm, cho phép địa chỉ IP gửi thư và bật hộp Yêu cầu mã hoá TLS.", en: "SMTP relay service: press Add, allow the sending IP address and tick Require TLS encryption." }, link: { label: { vi: "Hướng dẫn của Google", en: "Google's guide" }, url: "https://knowledge.workspace.google.com/admin/gmail/advanced/route-outgoing-smtp-relay-messages-through-google" } },
        ],
        cautions: [{ vi: "Mỗi người dùng được chuyển tiếp tối đa 10.000 người nhận mỗi ngày.", en: "Each user can relay up to 10,000 recipients per day." }],
      },
    ],
  },
  {
    id: "gmail",
    title: { vi: "Gmail cá nhân", en: "Personal Gmail" },
    blurb: { vi: "Email dạng ten@gmail.com.", en: "Email like name@gmail.com." },
    modes: [{
      id: "app_password", label: { vi: "Mật khẩu ứng dụng", en: "App password" },
      when: { vi: "Cách duy nhất cho Gmail cá nhân. Không dùng mật khẩu đăng nhập Gmail.", en: "The only way for personal Gmail. Do not use your Gmail login password." },
      host: "smtp.gmail.com", port: 587, security: "starttls", userIsEmail: true,
      passwordLabel: APP_PASSWORD_LABEL, passwordHint: APP_PASSWORD_HINT, steps: APP_PASSWORD_STEPS,
      cautions: [
        { vi: "Gmail cá nhân chỉ nên gửi khoảng 500 email mỗi ngày. Vượt quá, Google tạm khoá việc gửi. Phù hợp cho báo cáo và biên nhận, không phải cho gửi hàng loạt.", en: "Personal Gmail should send about 500 emails per day. Beyond that Google pauses sending. Fine for reports and receipts, not for bulk mail." },
      ],
    }],
  },
  {
    id: "microsoft365",
    title: { vi: "Microsoft 365 / Outlook", en: "Microsoft 365 / Outlook" },
    blurb: { vi: "Email công ty chạy trên Microsoft 365, hoặc Outlook.", en: "Company email on Microsoft 365, or Outlook." },
    modes: [{
      id: "smtp_auth", label: { vi: "SMTP có xác thực", en: "Authenticated SMTP" },
      when: { vi: "Dùng chính hộp thư Microsoft 365 để gửi.", en: "Send from the Microsoft 365 mailbox itself." },
      host: "smtp.office365.com", port: 587, security: "starttls", userIsEmail: true,
      passwordLabel: { vi: "Mật khẩu hộp thư", en: "Mailbox password" },
      passwordHint: { vi: "Mật khẩu của hộp thư gửi. Nếu có bật Xác minh 2 bước, cần mật khẩu ứng dụng hoặc để quản trị viên cho phép.", en: "The sending mailbox's password. With multi-factor sign-in you need an app password or an admin exception." },
      steps: [
        { text: { vi: "Nhờ quản trị viên Microsoft 365 bật SMTP AUTH cho hộp thư sẽ gửi (Trung tâm quản trị > Người dùng > chọn người dùng > Thư > Quản lý ứng dụng email > Authenticated SMTP).", en: "Ask your Microsoft 365 admin to enable SMTP AUTH for the sending mailbox (Admin center > Users > pick the user > Mail > Manage email apps > Authenticated SMTP)." }, link: { label: { vi: "Hướng dẫn của Microsoft", en: "Microsoft's guide" }, url: "https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission" } },
        { text: { vi: "Quay lại đây, nhập địa chỉ email và mật khẩu của hộp thư đó.", en: "Come back here and enter that mailbox's address and password." } },
      ],
      cautions: [
        { vi: "Microsoft đang loại bỏ đăng nhập bằng mật khẩu (basic auth) cho SMTP ở nhiều tổ chức. Nếu gửi thử báo sai mật khẩu dù đúng, tổ chức của bạn có thể đã bị chặn; hãy dùng Google, Zoho hoặc dịch vụ gửi mail thay thế.", en: "Microsoft is retiring basic authentication for SMTP in many tenants. If a test says wrong password although it is right, your tenant may be blocked; use Google, Zoho or a mail service instead." },
        { vi: "Giới hạn khoảng 30 email mỗi phút và 10.000 người nhận mỗi ngày.", en: "Limit is about 30 messages per minute and 10,000 recipients per day." },
      ],
    }],
  },
  {
    id: "zoho",
    title: { vi: "Zoho Mail", en: "Zoho Mail" },
    blurb: { vi: "Email Zoho miễn phí hoặc trả phí theo tên miền.", en: "Free Zoho mail or a paid custom-domain mailbox." },
    modes: [
      {
        id: "custom_domain", label: { vi: "Email theo tên miền (gói trả phí)", en: "Custom-domain mailbox (paid plan)" },
        when: { vi: "Địa chỉ dạng ten@congty.vn trên Zoho.", en: "An address like name@company.com on Zoho." },
        host: "smtppro.zoho.com", port: 587, security: "starttls", userIsEmail: true,
        passwordLabel: { vi: "Mật khẩu hoặc mật khẩu ứng dụng", en: "Password or app-specific password" },
        passwordHint: { vi: "Nếu bật xác thực 2 lớp, tạo mật khẩu ứng dụng trong Zoho Accounts.", en: "With two-factor sign-in, create an app-specific password in Zoho Accounts." },
        steps: [
          { text: { vi: "Nếu đã bật xác thực 2 lớp, mở Zoho Accounts > Bảo mật > Mật khẩu ứng dụng và tạo một mật khẩu tên NIVO.", en: "If two-factor is on, open Zoho Accounts > Security > App passwords and create one named NIVO." }, link: { label: { vi: "Mở Zoho Accounts", en: "Open Zoho Accounts" }, url: "https://accounts.zoho.com/home#security/app_password" } },
          { text: { vi: "Nhập địa chỉ email Zoho và mật khẩu ở bước sau. Địa chỉ gửi phải đúng là địa chỉ (hoặc bí danh) của tài khoản này.", en: "Enter the Zoho address and password on the next step. The sender must be this account's address or alias." } },
        ],
        cautions: [{ vi: "Tài khoản Zoho ở trung tâm dữ liệu khác (zoho.eu, zoho.in) dùng máy chủ khác, ví dụ smtppro.zoho.eu. Chưa kiểm chứng đầy đủ.", en: "Zoho accounts in other data centres (zoho.eu, zoho.in) use another host, for example smtppro.zoho.eu. Not fully verified." }],
      },
      {
        id: "personal", label: { vi: "Email @zohomail.com (miễn phí)", en: "@zohomail.com mailbox (free)" },
        when: { vi: "Địa chỉ dạng ten@zohomail.com.", en: "An address like name@zohomail.com." },
        host: "smtp.zoho.com", port: 587, security: "starttls", userIsEmail: true,
        passwordLabel: { vi: "Mật khẩu hoặc mật khẩu ứng dụng", en: "Password or app-specific password" },
        passwordHint: { vi: "Nếu bật xác thực 2 lớp, tạo mật khẩu ứng dụng trong Zoho Accounts.", en: "With two-factor sign-in, create an app-specific password in Zoho Accounts." },
        steps: [{ text: { vi: "Nhập địa chỉ email Zoho và mật khẩu (hoặc mật khẩu ứng dụng) ở bước sau.", en: "Enter the Zoho address and password (or app-specific password) on the next step." } }],
        cautions: [],
      },
    ],
  },
  {
    id: "vn_hosting",
    title: { vi: "Email hosting Việt Nam (Mắt Bão, PA Việt Nam, Nhân Hòa…)", en: "Vietnamese email hosting (Mat Bao, PA Vietnam, Nhan Hoa…)" },
    blurb: { vi: "Email theo tên miền mua tại nhà cung cấp hosting trong nước.", en: "Domain email bought from a local hosting provider." },
    modes: [{
      id: "hosting", label: { vi: "Nhập thông tin từ nhà cung cấp", en: "Enter the provider's details" },
      when: { vi: "Mỗi nhà cung cấp có máy chủ riêng. Bạn lấy máy chủ gửi thư (SMTP) và cổng trong email họ gửi khi mở dịch vụ, hoặc trong trang quản lý email.", en: "Each provider has its own server. Find the outgoing (SMTP) server and port in the email they sent when you opened the service, or in the mailbox settings page." },
      host: "", port: 587, security: "starttls", hostEditable: true, userIsEmail: true,
      passwordLabel: { vi: "Mật khẩu hộp thư", en: "Mailbox password" },
      passwordHint: { vi: "Mật khẩu bạn dùng để đăng nhập webmail của hộp thư này.", en: "The password you use for this mailbox's webmail." },
      steps: [
        { text: { vi: "Mở email chào mừng hoặc trang quản lý email của nhà cung cấp, tìm mục Cấu hình thư khách (Outlook, Thunderbird).", en: "Open the provider's welcome email or mailbox page and find the mail client settings (Outlook, Thunderbird)." } },
        { text: { vi: "Chép Máy chủ thư đi (SMTP) và Cổng. Thường là mail.tenmiencuaban.vn, cổng 587 (STARTTLS) hoặc 465 (SSL). Tên đăng nhập thường là đầy đủ địa chỉ email.", en: "Copy the Outgoing server (SMTP) and Port. Often mail.yourdomain.vn, port 587 (STARTTLS) or 465 (SSL). The username is usually the full email address." } },
      ],
      cautions: [{ vi: "Một số hosting giới hạn số email mỗi giờ (thường vài trăm). Hỏi nhà cung cấp nếu cần gửi nhiều.", en: "Some hosts cap emails per hour (often a few hundred). Ask the provider if you need more." }],
    }],
  },
  {
    id: "relay_service",
    title: { vi: "Dịch vụ gửi mail (Resend, SendGrid, Amazon SES)", en: "Mail sending service (Resend, SendGrid, Amazon SES)" },
    blurb: { vi: "Dành cho gửi nhiều và đáng tin cậy. Cần xác minh tên miền gửi.", en: "For higher volume and reliability. You must verify the sending domain." },
    modes: [
      {
        id: "resend", label: { vi: "Resend", en: "Resend" },
        when: { vi: "Đơn giản nhất trong ba dịch vụ.", en: "The simplest of the three." },
        host: "smtp.resend.com", port: 587, security: "starttls", fixedUser: "resend",
        passwordLabel: { vi: "Khoá API", en: "API key" }, passwordHint: { vi: "Khoá API Resend (bắt đầu bằng re_).", en: "Your Resend API key (starts with re_)." },
        steps: [
          { text: { vi: "Tạo tài khoản Resend và xác minh tên miền gửi.", en: "Create a Resend account and verify your sending domain." }, link: { label: { vi: "Mở Resend Domains", en: "Open Resend Domains" }, url: "https://resend.com/domains" } },
          { text: { vi: "Tạo khoá API, sao chép và dán vào ô Khoá API.", en: "Create an API key, copy it and paste it into the API key box." }, link: { label: { vi: "Mở Resend API Keys", en: "Open Resend API Keys" }, url: "https://resend.com/api-keys" } },
        ],
        cautions: [{ vi: "Email gửi đi phải có đuôi đúng tên miền đã xác minh.", en: "The from address must be on the verified domain." }],
      },
      {
        id: "sendgrid", label: { vi: "SendGrid", en: "SendGrid" },
        when: { vi: "Tên đăng nhập luôn là chữ apikey.", en: "The username is always the word apikey." },
        host: "smtp.sendgrid.net", port: 587, security: "starttls", fixedUser: "apikey",
        passwordLabel: { vi: "Khoá API", en: "API key" }, passwordHint: { vi: "Khoá API SendGrid có quyền Mail Send (bắt đầu bằng SG.).", en: "A SendGrid API key with Mail Send permission (starts with SG.)." },
        steps: [
          { text: { vi: "Xác minh người gửi (Sender Authentication) cho địa chỉ hoặc tên miền gửi.", en: "Complete Sender Authentication for your sending address or domain." }, link: { label: { vi: "Mở SendGrid", en: "Open SendGrid" }, url: "https://app.sendgrid.com/settings/sender_auth" } },
          { text: { vi: "Tạo Khoá API với quyền Mail Send, sao chép và dán vào đây.", en: "Create an API key with Mail Send permission, copy it and paste it here." }, link: { label: { vi: "Mở API Keys", en: "Open API Keys" }, url: "https://app.sendgrid.com/settings/api_keys" } },
        ],
        cautions: [],
      },
      {
        id: "ses", label: { vi: "Amazon SES", en: "Amazon SES" },
        when: { vi: "Cần tài khoản AWS. Mật khẩu SMTP KHÁC khoá bí mật AWS.", en: "Needs an AWS account. The SMTP password is NOT your AWS secret key." },
        host: "email-smtp.ap-southeast-1.amazonaws.com", port: 587, security: "starttls", hostEditable: true,
        passwordLabel: { vi: "Mật khẩu SMTP của SES", en: "SES SMTP password" }, passwordHint: { vi: "Tên đăng nhập và mật khẩu SMTP do SES tạo (Create SMTP credentials).", en: "The SMTP username and password SES generates (Create SMTP credentials)." },
        steps: [
          { text: { vi: "Trong SES, mục SMTP settings, bấm Create SMTP credentials; sao chép tên đăng nhập và mật khẩu (chỉ hiện một lần).", en: "In SES, open SMTP settings and press Create SMTP credentials; copy the username and password (shown once)." }, link: { label: { vi: "Hướng dẫn của AWS", en: "AWS guide" }, url: "https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html" } },
          { text: { vi: "Máy chủ có dạng email-smtp.<vùng>.amazonaws.com; sửa vùng cho đúng vùng bạn dùng.", en: "The host looks like email-smtp.<region>.amazonaws.com; change the region to yours." } },
        ],
        cautions: [{ vi: "Tài khoản SES mới ở chế độ sandbox: chỉ gửi được tới địa chỉ đã xác minh cho tới khi AWS cho ra khỏi sandbox.", en: "A new SES account is in sandbox: it can only send to verified addresses until AWS lifts it." }],
      },
    ],
  },
];

export const presetOf = (id: string): SmtpPreset | null => SMTP_PRESETS.find((p) => p.id === id) ?? null;
export const modeOf = (preset: SmtpPreset, id: string): SmtpMode => preset.modes.find((m) => m.id === id) ?? preset.modes[0];
