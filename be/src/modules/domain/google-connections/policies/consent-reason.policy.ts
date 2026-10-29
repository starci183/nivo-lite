/** The prefix of the last_error a refused consent leaves on a Google connection. */
export const CONSENT_PREFIX = "consent:"

import { GoogleError, isConsentFailure } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "../errors/google-connections.error"

/** The reason the browser gets when Google answered the consent with an error instead of a code. */
export const deniedReason = (code: string): string => {
    if (!isConsentFailure(code)) return "failed"
    return code === "access_denied" ? "denied" : "unavailable"
}

/** The consent failure code Google gave in a failed token call, or blank when it is not one. */
export const consentFailureOf = (error: unknown): string => {
    const reason = error instanceof GoogleError ? String(error.params.reason ?? "") : ""
    return isConsentFailure(reason) ? reason : ""
}

/** The reason the browser gets when storing a consent failed. */
export const storeFailureReason = (error: unknown): string => {
    if (consentFailureOf(error) !== "") return "unavailable"
    if (!(error instanceof GoogleConnectionsError)) return "failed"
    if (error.code === GoogleConnectionsErrorCode.Missing) return "no_refresh"
    return error.code === GoogleConnectionsErrorCode.ScopeMissing ? "scope" : "failed"
}
