import type { AutomationsTranslator } from "@/modules/types"

/** The message of each refusal the plan of a change can give. */
const FAULT_KEYS: Readonly<Record<string, string>> = {
    AUTOMATIONS_COMING_SOON: "faultAutomationsComingSoon",
    AUTOMATIONS_REQUIREMENT_MISSING: "faultAutomationsRequirementMissing",
    AUTOMATIONS_NO_MESSAGE: "faultAutomationsNoMessage",
    AUTOMATIONS_BODY_TOO_SHORT: "faultAutomationsBodyTooShort",
    AUTOMATIONS_BODY_UNKNOWN_VARIABLE: "faultAutomationsBodyUnknownVariable",
    AUTOMATIONS_GOOGLE_NOT_USED: "faultAutomationsGoogleNotUsed",
    AUTOMATIONS_GOOGLE_ACCOUNT_UNKNOWN: "faultAutomationsGoogleAccountUnknown",
    AUTOMATIONS_TRUST_NOT_OFFERED: "faultAutomationsTrustNotOffered",
    AUTOMATIONS_NOTHING_TO_CHANGE: "faultAutomationsNothingToChange",
    AUTOMATIONS_PIPELINE_OFF: "faultAutomationsPipelineOff",
    AUTOMATIONS_RUN_NOW_UNAVAILABLE: "faultAutomationsRunNowUnavailable",
    AUTOMATIONS_NOT_SAVED: "faultAutomationsNotSaved",
}

/** A failure as the database boundary words it. */
interface AutomationFault {
    readonly kind: string
    readonly code: string
}

/** The words for a failure: its own message when the owner can act on it, else the refusal or the general line. */
export const automationFaultText = (t: AutomationsTranslator, failure: AutomationFault): string => {
    const key = FAULT_KEYS[failure.code]
    if (key !== undefined) return t(key)
    return failure.kind === "refused" ? t("faultRefused") : t("faultGeneric")
}
