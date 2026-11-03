import type { EnvSource } from "@modules/platform/config"
import type { IdentityAuthOptions } from "./identity-auth.options"

const INVITE_TTL_SECONDS = 604_800

/** Reads the sign-in options of identity: the lifetime of an invitation link is optional (the confirmation and reset links belong to the mail settings). */
export const parseIdentityAuthConfig = (env: EnvSource): IdentityAuthOptions => ({
    inviteTtlSeconds: env.int("AUTH_INVITE_TTL_SECONDS", INVITE_TTL_SECONDS),
})
