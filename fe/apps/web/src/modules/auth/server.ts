import "server-only"

import { cookies } from "next/headers"
import type { GraphQLResponse } from "@/modules/types"
import type { EmailOtpType } from "@supabase/supabase-js"
import { authFailure, authOk, failureOf } from "./outcome"
import { cookieAuthClient } from "./server-client"

export { refreshSession } from "./server-client"

const EMAIL_LINK_TYPES: ReadonlyArray<EmailOtpType> = [
    "signup",
    "recovery",
    "invite",
    "email_change",
    "magiclink",
    "email",
]

interface EmailLinkOtp {
    readonly token_hash: string
    readonly type: string
}

/** Exchanges the one-time PKCE code and writes the session into the current request's cookies. */
export const exchangeAuthCode = async (code: string): Promise<GraphQLResponse<true>> => {
    const { error } = await cookieAuthClient(await cookies()).auth.exchangeCodeForSession(code)
    return failureOf(error) ?? authOk(true)
}

/** Validates an email link's kind before accessing cookies or verifying its token hash. */
export const verifyOtp = async ({ token_hash, type }: EmailLinkOtp): Promise<GraphQLResponse<true>> => {
    const linkType = EMAIL_LINK_TYPES.find((candidate) => candidate === type)
    if (linkType === undefined) return authFailure("invalid", "link-type")
    const { error } = await cookieAuthClient(await cookies()).auth.verifyOtp({ type: linkType, token_hash })
    return failureOf(error) ?? authOk(true)
}
