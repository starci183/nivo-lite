import type { ZaloTone, ZnsRenewalForm } from "@/modules/types"

/** How often the live panel asks for newer events. */
export const ZALO_EVENTS_POLL_MS = 5000

/** How often the page asks again while the connection needs attention (a reconnect finishes in the background). */
export const ZALO_PAGE_POLL_MS = 8000

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
