import type {
    SepayConnectionView,
    SepayEnvironment,
    SepayEventKind,
    SepayEventOutcome,
    SepayEventView,
    SepayStepView,
} from "@/modules/types"

/** How often the page and the event panel look again while open: the panel is live. */
export const SEPAY_POLL_MS = 5_000

/** The words a skeleton connection is drawn with, from the catalog. */
export interface SepayPlaceholderWords {
    readonly name: string
    readonly bank: string
    readonly holder: string
}

/** A same-shape connection drawn as a skeleton while the read is in flight. */
export const sepayPlaceholderOf = (words: SepayPlaceholderWords): SepayConnectionView => ({
    id: "placeholder",
    name: words.name,
    status: "connected",
    environment: "test",
    lastError: null,
    bankCode: "VCB",
    bank: words.bank,
    accountMasked: "**** 0000",
    hasFullAccount: true,
    holder: words.holder,
    webhookUrl: "https://example.vn/api/connections/sepay/00000000",
    apiKeyMasked: "•".repeat(16),
    pingSeenAt: null,
    transactionSeenAt: null,
    health: { lastWebhookAt: null, validCount: 0, totalCount: 0, duplicateCount: 0 },
    agentIds: [],
})

/** Same-shape events drawn as a skeleton. */
export const SEPAY_EVENTS_PLACEHOLDER: ReadonlyArray<SepayEventView> = [0, 1, 2].map((index) => ({
    id: `placeholder-${index}`,
    at: "2026-01-01T00:00:00.000Z",
    outcome: "accepted",
    kind: "credit",
    amountVnd: 0,
    providerEventId: "000000",
    environment: "test",
}))

/** The wire connection: the page model with its environment still open text. */
export type SepayConnectionWire = Omit<SepayConnectionView, "environment"> & { readonly environment: string }

/** The wire delivery: the page model with its three enums still open text. */
export type SepayEventWire = Omit<SepayEventView, "outcome" | "kind" | "environment"> & {
    readonly outcome: string
    readonly kind: string
    readonly environment: string
}

/** The wire answer of the connection read, narrowed to the page model. */
export const sepayConnectionOf = (wire: SepayConnectionWire): SepayConnectionView => ({
    ...wire,
    environment: wire.environment === "live" ? "live" : "test",
    agentIds: [...wire.agentIds],
})

const OUTCOMES: ReadonlyArray<SepayEventOutcome> = ["accepted", "duplicate", "unauthorized"]
const KINDS: ReadonlyArray<SepayEventKind> = ["credit", "debit", "ping"]

/** The wire answer of the event list, narrowed to the page model. */
export const sepayEventOf = (wire: SepayEventWire): SepayEventView => ({
    ...wire,
    outcome: OUTCOMES.find((outcome) => outcome === wire.outcome) ?? "accepted",
    kind: KINDS.find((kind) => kind === wire.kind) ?? "ping",
    environment: wire.environment === "live" ? "live" : "test",
})

/**
 * The test checklist from what the door really saw: the ping makes step 1 and 2 true (SePay test mode is on), a landed transaction makes
 * step 3 and 4 true; the first step not true yet is the active one.
 */
export const sepayStepsOf = (view: SepayConnectionView): ReadonlyArray<SepayStepView> => {
    const received = view.transactionSeenAt !== null
    const pinged = view.pingSeenAt !== null || received
    const flags: ReadonlyArray<readonly [SepayStepView["id"], boolean]> = [
        ["ping", pinged],
        ["simulate", pinged],
        ["wait", received],
        ["receive", received],
    ]
    const firstOpen = flags.findIndex(([, done]) => !done)
    return flags.map(([id, done], index) => {
        if (done) return { id, state: "done" }
        return { id, state: index === firstOpen ? "active" : "pending" }
    })
}

/** The tone of a connection status. */
export const sepayStatusTone = (status: string): "success" | "danger" | "warning" | "neutral" => {
    if (status === "connected") return "success"
    if (status === "error") return "danger"
    return status === "pending" ? "warning" : "neutral"
}

/** The environment the other button switches to. */
export const otherEnvironment = (environment: SepayEnvironment): SepayEnvironment =>
    environment === "test" ? "live" : "test"

/** The tabs of the SePay connection page, in order. */
export const SEPAY_TAB_IDS = ["overview", "setup", "test", "agents"] as const
