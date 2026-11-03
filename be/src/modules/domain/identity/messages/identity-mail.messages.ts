import { renderTransactional } from "@modules/integrations/mail"
import type { MailLanguage, RenderedMail } from "@modules/integrations/mail"

/** What an invitation mail to a person who already has an account is drawn from. */
export interface InviteMailInput {
    /** The product name in the header. */
    readonly brand: string
    /** The absolute link the button opens. */
    readonly url: string
}

/** What a confirmation, reset or first-password mail is drawn from. */
export interface LinkMailInput extends InviteMailInput {
    /** How many hours the link lives. */
    readonly hours: number
}

interface LinkCopy<Input extends InviteMailInput> {
    readonly subject: string
    readonly paragraphs: (input: Input) => readonly string[]
    readonly button: string
    readonly footer: string
}

const CONFIRM: Record<MailLanguage, LinkCopy<LinkMailInput>> = {
    vi: {
        subject: "Xác nhận email của bạn",
        paragraphs: ({ brand, hours }) => [`Cảm ơn bạn đã đăng ký ${brand}.`, `Nhấn nút bên dưới để xác nhận email. Liên kết có hiệu lực trong ${String(hours)} giờ và chỉ dùng được một lần.`],
        button: "Xác nhận email",
        footer: "Nếu bạn không đăng ký, hãy bỏ qua thư này.",
    },
    en: {
        subject: "Confirm your email",
        paragraphs: ({ brand, hours }) => [`Thanks for signing up to ${brand}.`, `Press the button below to confirm your email. The link works once and lasts ${String(hours)} hours.`],
        button: "Confirm email",
        footer: "If you did not sign up, ignore this message.",
    },
}

const RESET: Record<MailLanguage, LinkCopy<LinkMailInput>> = {
    vi: {
        subject: "Đặt lại mật khẩu",
        paragraphs: ({ hours }) => ["Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.", `Nhấn nút bên dưới để chọn mật khẩu mới. Liên kết có hiệu lực trong ${String(hours)} giờ và chỉ dùng được một lần.`],
        button: "Đặt lại mật khẩu",
        footer: "Nếu bạn không yêu cầu, hãy bỏ qua thư này; mật khẩu của bạn không thay đổi.",
    },
    en: {
        subject: "Reset your password",
        paragraphs: ({ hours }) => ["We received a request to reset the password of your account.", `Press the button below to choose a new password. The link works once and lasts ${String(hours)} hours.`],
        button: "Reset password",
        footer: "If you did not ask for this, ignore this message; your password stays as it is.",
    },
}

const INVITE_ACCOUNT: Record<MailLanguage, LinkCopy<LinkMailInput>> = {
    vi: {
        subject: "Đặt mật khẩu cho tài khoản của bạn",
        paragraphs: ({ brand, hours }) => [`Bạn được mời vào ${brand}. Hãy đặt mật khẩu để hoàn tất tài khoản.`, `Liên kết có hiệu lực trong ${String(hours)} giờ và chỉ dùng được một lần.`],
        button: "Đặt mật khẩu",
        footer: "Nếu bạn không mong đợi thư này, hãy bỏ qua nó.",
    },
    en: {
        subject: "Set your password",
        paragraphs: ({ brand, hours }) => [`You were invited to ${brand}. Set a password to finish creating your account.`, `The link works once and lasts ${String(hours)} hours.`],
        button: "Set password",
        footer: "If you did not expect this email, you can ignore it.",
    },
}

const INVITE_EXISTING: Record<MailLanguage, LinkCopy<InviteMailInput>> = {
    vi: {
        subject: "Bạn được mời vào một không gian làm việc",
        paragraphs: ({ brand }) => [`Bạn được mời vào một không gian làm việc trên ${brand}.`, "Đăng nhập và chấp nhận lời mời tại đây."],
        button: "Xem lời mời",
        footer: "Nếu bạn không mong đợi thư này, hãy bỏ qua nó.",
    },
    en: {
        subject: "You were invited to a workspace",
        paragraphs: ({ brand }) => [`You were invited to a workspace on ${brand}.`, "Sign in and accept the invitation here."],
        button: "View invitation",
        footer: "If you did not expect this email, you can ignore it.",
    },
}

const draw = <Input extends InviteMailInput>(copy: LinkCopy<Input>, lang: MailLanguage, input: Input): RenderedMail =>
    renderTransactional({
        lang,
        subject: copy.subject,
        brand: { name: input.brand },
        paragraphs: copy.paragraphs(input),
        action: { label: copy.button, url: input.url },
        footer: copy.footer,
    })

/** The mail that carries the link confirming a mailbox. */
export const confirmEmailMail = (lang: MailLanguage, input: LinkMailInput): RenderedMail => draw(CONFIRM[lang], lang, input)

/** The mail that carries the link choosing a new password. */
export const resetPasswordMail = (lang: MailLanguage, input: LinkMailInput): RenderedMail => draw(RESET[lang], lang, input)

/** The mail that carries the link choosing the first password of an invited person. */
export const inviteAccountMail = (lang: MailLanguage, input: LinkMailInput): RenderedMail => draw(INVITE_ACCOUNT[lang], lang, input)

/** The mail that carries an invitation link to a person who already has an account. */
export const inviteExistingMail = (lang: MailLanguage, input: InviteMailInput): RenderedMail => draw(INVITE_EXISTING[lang], lang, input)
