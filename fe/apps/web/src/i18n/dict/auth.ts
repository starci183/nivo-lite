import en from "@/modules/i18n/messages/en/auth.json"
import vi from "@/modules/i18n/messages/vi/auth.json"
import { defineDict } from "../core"

/** Sign-up, e-mail confirmation, forgot / reset password and the shared auth error copy. */
export const auth = defineDict("auth", { en, vi })

/** Error codes the auth server actions return; each maps to one `err*` key. */
export type AuthErrorCode =
    | "invalid_credentials"
    | "email_not_confirmed"
    | "too_many"
    | "weak_password"
    | "same_password"
    | "link_invalid"
    | "signup_disabled"
    | "generic"

export const AUTH_ERROR_KEY = {
    invalid_credentials: "errInvalidCredentials",
    email_not_confirmed: "errEmailNotConfirmed",
    too_many: "errTooMany",
    weak_password: "errWeakPassword",
    same_password: "errSamePassword",
    link_invalid: "errLinkInvalid",
    signup_disabled: "errSignupDisabled",
    generic: "errGeneric",
} as const satisfies Record<AuthErrorCode, keyof typeof auth.en>
