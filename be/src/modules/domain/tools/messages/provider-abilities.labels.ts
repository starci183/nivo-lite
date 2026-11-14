/** A display name in the owner's two languages. */
export interface AbilityLabel {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The display name of each provider kind. */
export const KIND_LABELS: Readonly<Record<string, AbilityLabel>> = {
    messaging: { vi: "Nhắn tin", en: "Messaging" },
    payment: { vi: "Thanh toán", en: "Payment" },
    books: { vi: "Sổ sách", en: "Books" },
    mail: { vi: "Email", en: "Email" },
    records: { vi: "Hồ sơ nghiệp vụ", en: "Business records" },
    domain: { vi: "Tên miền", en: "Domains" },
    media: { vi: "Âm thanh, video", en: "Audio and video" },
}

/** The display name of each provider. */
export const PROVIDER_LABELS: Readonly<Record<string, AbilityLabel>> = {
    zalo_oa: { vi: "Zalo OA", en: "Zalo OA" },
    telegram: { vi: "Telegram", en: "Telegram" },
    meta: { vi: "Facebook, Instagram", en: "Facebook, Instagram" },
    sepay: { vi: "SePay", en: "SePay" },
    casso: { vi: "Casso", en: "Casso" },
    payos: { vi: "payOS", en: "payOS" },
    google: { vi: "Google", en: "Google" },
    smtp: { vi: "Email (SMTP)", en: "Email (SMTP)" },
    imap: { vi: "Hộp thư (IMAP)", en: "Mailbox (IMAP)" },
    openapi: { vi: "Hệ thống riêng (OpenAPI)", en: "Your own system (OpenAPI)" },
    inet: { vi: "iNET", en: "iNET" },
    tino: { vi: "Tino", en: "Tino" },
    elevenlabs: { vi: "ElevenLabs", en: "ElevenLabs" },
    veo: { vi: "Google Veo", en: "Google Veo" },
    tiktok: { vi: "TikTok", en: "TikTok" },
    shotstack: { vi: "Shotstack", en: "Shotstack" },
    creatomate: { vi: "Creatomate", en: "Creatomate" },
    json2video: { vi: "JSON2Video", en: "JSON2Video" },
    misa_amis: { vi: "MISA AMIS", en: "MISA AMIS" },
    misa_meinvoice: { vi: "MISA meInvoice", en: "MISA meInvoice" },
}

/** The display name of each ability, in business words, by provider then ability id. */
export const ABILITY_LABELS: Readonly<Record<string, Readonly<Record<string, AbilityLabel>>>> = {
    zalo_oa: {
        "customer.send": { vi: "Gửi tin cho khách qua Zalo", en: "Send to customers on Zalo" },
    },
    telegram: {
        "customer.send": { vi: "Gửi tin cho khách qua Telegram", en: "Send to customers on Telegram" },
    },
    meta: {
        "customer.send": {
            vi: "Gửi tin cho khách qua Facebook, Instagram",
            en: "Send to customers on Facebook and Instagram",
        },
        "facebook.publish": { vi: "Đăng bài lên trang Facebook", en: "Publish to the Facebook Page" },
        "instagram.publish": { vi: "Đăng lên Instagram", en: "Publish to Instagram" },
        "instagram.read": { vi: "Xem bài Instagram đang xử lý", en: "Read Instagram posts in processing" },
    },
    sepay: {
        "transactions.read": { vi: "Đọc giao dịch ngân hàng", en: "Read bank transactions" },
        "transfer.instruction": { vi: "Lập thông tin chuyển khoản (QR, số tài khoản)", en: "Make bank-transfer details (QR, account number)" },
    },
    casso: {
        "transactions.read": { vi: "Đọc tiền về tài khoản", en: "Read the credits received" },
    },
    payos: {
        "transactions.read": { vi: "Đọc một khoản tiền vào", en: "Read one bank credit" },
        "link.create": { vi: "Tạo link thanh toán", en: "Create a payment link" },
        "link.read": { vi: "Xem link thanh toán", en: "Read a payment link" },
        "link.cancel": { vi: "Huỷ link thanh toán", en: "Cancel a payment link" },
    },
    google: {
        "ledger.read": { vi: "Xem sổ Google Sheet", en: "Read the Google Sheet ledger status" },
        "ledger.write": { vi: "Ghi sổ Google Sheet", en: "Write the Google Sheet ledger" },
        "drive.read": { vi: "Xem tài liệu Google Drive", en: "Read Google Drive sources" },
        "calendar.read": { vi: "Xem giờ trống trên Google Calendar", en: "Read free slots on Google Calendar" },
        "calendar.write": { vi: "Tạo, sửa, hủy sự kiện trên Google Calendar", en: "Create, change and cancel Google Calendar events" },
        "youtube.read": { vi: "Xem video YouTube", en: "Read YouTube videos" },
        "youtube.publish": { vi: "Đăng video lên YouTube", en: "Publish videos to YouTube" },
    },
    smtp: {
        "email.send": { vi: "Gửi email cho khách", en: "Send email to customers" },
    },
    imap: {
        "mail.read": { vi: "Đọc thư trong hộp thư", en: "Read mail in the mailbox" },
    },
    inet: {
        "domain.read": { vi: "Xem tên miền và bản ghi DNS", en: "Read domains and DNS records" },
        "domain.register": { vi: "Đăng ký, gia hạn, chuyển tên miền", en: "Register, renew and transfer domains" },
        "dns.write": { vi: "Sửa bản ghi DNS và nameserver", en: "Change DNS records and nameservers" },
    },
    tino: {
        "domain.read": { vi: "Xem tên miền và bản ghi DNS", en: "Read domains and DNS records" },
        "domain.register": { vi: "Đăng ký, gia hạn, chuyển tên miền", en: "Register, renew and transfer domains" },
        "dns.write": { vi: "Sửa bản ghi DNS và nameserver", en: "Change DNS records and nameservers" },
    },
    elevenlabs: {
        "media.read": { vi: "Xem giọng đọc và việc lồng tiếng", en: "Read the voices and the dubbing jobs" },
        "speech.create": { vi: "Đọc văn bản thành giọng nói", en: "Turn text into speech" },
        "dubbing.create": { vi: "Lồng tiếng video sang ngôn ngữ khác", en: "Dub a video into another language" },
    },
    veo: {
        "media.read": { vi: "Xem video đang tạo", en: "Read the video generations" },
        "video.create": { vi: "Tạo video từ mô tả", en: "Generate a video from a description" },
    },
    tiktok: {
        "tiktok.read": { vi: "Xem trạng thái video và giới hạn đăng TikTok", en: "Read TikTok post status and posting limits" },
        "tiktok.publish": { vi: "Đăng video lên TikTok", en: "Publish videos to TikTok" },
    },
    shotstack: {
        "media.read": { vi: "Xem video đang dựng", en: "Read the video renders" },
        "video.compose": { vi: "Dựng video từ các đoạn phim, giọng đọc, logo và phụ đề", en: "Compose a video from clips, voice, logo and captions" },
    },
    creatomate: {
        "media.read": { vi: "Xem video đang dựng", en: "Read the video renders" },
        "video.compose": { vi: "Dựng video từ các đoạn phim, giọng đọc, logo và phụ đề", en: "Compose a video from clips, voice, logo and captions" },
    },
    json2video: {
        "media.read": { vi: "Xem video đang dựng", en: "Read the video renders" },
        "video.compose": { vi: "Dựng video từ các đoạn phim, giọng đọc, logo và phụ đề", en: "Compose a video from clips, voice, logo and captions" },
    },
}

/** The label of a key in a table, or the key itself in both languages when the table has none (a spec keeps the tables whole). */
export const labelOf = (table: Readonly<Record<string, AbilityLabel>> | undefined, key: string): AbilityLabel =>
    table?.[key] ?? { vi: key, en: key }

/**
 * The name of one ability of a provider in business words (`email.send` of `smtp`: what a roll-up titles the work action that ability
 * holds), or the ability id itself in both languages when the provider's table has none.
 */
export const abilityLabelOf = (provider: string, abilityId: string): AbilityLabel => labelOf(ABILITY_LABELS[provider], abilityId)
