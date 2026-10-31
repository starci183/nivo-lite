import type { ZaloStepId, ZaloTone, ZnsRenewalForm } from "@/modules/types"

/** How often the live panel asks for newer events. */
export const ZALO_EVENTS_POLL_MS = 5000

/** How often the page asks again while the connection needs attention (a reconnect finishes in the background). */
export const ZALO_PAGE_POLL_MS = 8000

/** What the status chip says: it works, it is authorized and waits for the first Zalo event, or it needs a look. */
export type ZaloStatusKind = "ok" | "waiting" | "check"

/** An authorized OA whose connection is still pending has no Zalo event yet: it waits for the first message, it is not broken. */
export const zaloStatusKindOf = (healthy: boolean, status: string, tokenState: string): ZaloStatusKind => {
    if (healthy) return "ok"
    const authorized = tokenState === "valid" || tokenState === "renewable"
    return status === "pending" && authorized ? "waiting" : "check"
}

/** The tone of the status chip: healthy is green, a token that cannot work is red, anything else is amber. */
export const chipToneOf = (healthy: boolean, tokenState: string, status: string): ZaloTone => {
    if (healthy) return "success"
    return tokenState === "expired" || tokenState === "none" || status === "error" ? "danger" : "warning"
}

/** The form while nothing is stored: every field empty, which leaves the fallback off. */
export const EMPTY_ZNS_FORM: ZnsRenewalForm = {
    templateId: "",
    customerName: "",
    plan: "",
    endDate: "",
    amount: "",
    transferContent: "",
    invoiceNumber: "",
}

/** What a setup step needs from the page to say whether it is done. */
export interface ZaloStepFacts {
    readonly appId: string
    readonly appSecretMask: string | null
    readonly oaSecretMask: string | null
    readonly tokenState: string
    readonly healthy: boolean
    readonly agentCount: number
}

/** The setup steps in the order the back end needs them, each true once the page shows it done. */
export const zaloStepsDone = (facts: ZaloStepFacts): ReadonlyArray<readonly [ZaloStepId, boolean]> => [
    ["app", facts.appId !== "" && facts.appSecretMask !== null],
    ["paste", facts.oaSecretMask !== null],
    ["authorize", facts.tokenState === "valid" || facts.tokenState === "renewable"],
    ["check", facts.healthy],
    ["agents", facts.agentCount > 0],
]

/** The step a page opens on: the first one not done, or none when every step is done. */
export const firstOpenStep = (done: ReadonlyArray<readonly [ZaloStepId, boolean]>): ZaloStepId | null =>
    done.find(([, isDone]) => !isDone)?.[0] ?? null
