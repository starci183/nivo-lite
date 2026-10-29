import { renderEmail } from "@modules/integrations/mail"

/** A rendered password email: subject plus both bodies. */
export interface PasswordMail {
    /** The one-line subject. */
    readonly subject: string
    /** The HTML body. */
    readonly html: string
    /** The plain-text body. */
    readonly text: string
}

const TITLES = {
    reset: "Reset your Nivo password",
    invite: "Set your Nivo password",
    confirm: "Confirm your Nivo email",
} as const

const INTROS = {
    reset: "We got a request to reset your Nivo password.",
    invite: "You were invited to Nivo. Set a password to finish creating your account.",
    confirm: "Welcome to Nivo. Confirm your email to finish creating your account.",
} as const

/** The email that carries a single-use link to set a password (a reset, or the first password of an invited person). */
export const passwordLinkMail = (
    kind: "reset" | "invite" | "confirm",
    link: string,
    expiresInHours: number,
): PasswordMail => {
    const title = TITLES[kind]
    const body = [
        INTROS[kind],
        `Open this link within ${expiresInHours} hours. It works once.\n${link}`,
        "If you did not expect this email, you can ignore it.",
    ].join("\n\n")
    const rendered = renderEmail({ shopName: "Nivo", title, body, footer: "Nivo", lang: "en" })
    return { subject: title, html: rendered.html, text: rendered.text }
}

/** The email that carries an invitation link to a person who already has an account. */
export const inviteLinkMail = (link: string): PasswordMail => {
    const title = "You were invited to a Nivo workspace"
    const body = `Sign in and accept the invitation here.\n${link}\n\nIf you did not expect this email, you can ignore it.`
    const rendered = renderEmail({ shopName: "Nivo", title, body, footer: "Nivo", lang: "en" })
    return { subject: title, html: rendered.html, text: rendered.text }
}
