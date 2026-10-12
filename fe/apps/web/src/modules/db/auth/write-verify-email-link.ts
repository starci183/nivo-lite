import "server-only"

import type { EmailOtpType } from "@supabase/supabase-js"
import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"

/** The e-mail link kinds Supabase Auth issues. */
export const EMAIL_LINK_TYPES: readonly EmailOtpType[] = [
    "signup",
    "recovery",
    "invite",
    "email_change",
    "magiclink",
    "email",
]

/** Whether the text is an e-mail link kind. */
export const isEmailLinkType = (value: string | null): value is EmailOtpType =>
    EMAIL_LINK_TYPES.some((type) => type === value)

/** Verifies an e-mail link token hash and lets the server client write the resulting session cookies. */
export const writeVerifyEmailLink = async (type: EmailOtpType, tokenHash: string) => {
    const client = await createServerDbClient()
    return toOutcome(await client.auth.verifyOtp({ type, token_hash: tokenHash }))
}
