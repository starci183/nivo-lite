import { BANK_TRIGGER_WORDS, MAIL_TRIGGER_WORDS, RENDER_TRIGGER_WORDS } from "./messages/provider-triggers.messages"
import type { ProviderTriggerDeclaration } from "./provider-triggers.contracts"

/** The name of the trigger a bank feed emits for each movement of the account. */
export const TRANSACTION_RECEIVED = "transaction.received"

/** The name of the trigger a mailbox emits after a sync that wrote mail. */
export const MAIL_RECEIVED = "mail.received"

/** The name of the trigger a compose provider emits when a render it was asked for finished (the compose purpose's intake fires it). */
export const RENDER_COMPLETED = "render.completed"

/** The cloud video compose providers: every one emits the same render trigger. */
export const COMPOSE_PROVIDERS: ReadonlyArray<string> = ["shotstack", "creatomate", "json2video"]

/** The bank feeds: every one emits the same trigger. */
export const BANK_FEED_PROVIDERS: ReadonlyArray<string> = ["sepay", "payos", "casso"]

/**
 * A movement of a bank account. One agent decides on it (the accounting agent bound to the feed books it, exactly as before triggers
 * existed; with none bound, the agent the owner binds), every other registered workflow is told. One run per transaction: the deciding
 * path's contract is one transaction per run, and a notice follows the same shape. A missed event comes back with the provider's
 * reconcile pass; handing it on twice is a no-op.
 */
const bankTransactionOf = (provider: string): ProviderTriggerDeclaration => ({
    provider,
    name: TRANSACTION_RECEIVED,
    kind: "webhook",
    description: BANK_TRIGGER_WORDS.trigger,
    payload: [
        { name: "transactionId", type: "id", description: BANK_TRIGGER_WORDS.transactionId, filterable: false },
        { name: "direction", type: "choice", of: ["in", "out"], description: BANK_TRIGGER_WORDS.direction, filterable: true },
    ],
    batching: { mode: "each" },
    recovery: "reconcile",
    subject: { kind: "bank-transaction", field: "transactionId" },
    decided: true,
})

/**
 * Mail arrived in a mailbox: emitted once after a sync that wrote at least one message row, as one list per sync. Nobody decides: each
 * registered workflow reads the new mail through its own cursor, so a missed wake only delays the read.
 */
const MAILBOX_MAIL: ProviderTriggerDeclaration = {
    provider: "imap",
    name: MAIL_RECEIVED,
    kind: "poll",
    description: MAIL_TRIGGER_WORDS.trigger,
    payload: [{ name: "count", type: "integer", description: MAIL_TRIGGER_WORDS.count, filterable: false }],
    batching: { mode: "list", maxEvents: 50 },
    recovery: "cursor",
    decided: false,
}

/**
 * A render the compose provider was asked for finished, done or failed: kept once as the account's `<provider>.render` row by the render
 * door's intake, which fires this. Nobody decides: it only reports work a run of NIVO requested, so its switch is ON by default (concept
 * triggers rule 6a) and the run that started the render takes it in its `wait`. A missed one is recovered by that run's status read.
 */
const renderCompletedOf = (provider: string): ProviderTriggerDeclaration => ({
    provider,
    name: RENDER_COMPLETED,
    kind: "webhook",
    description: RENDER_TRIGGER_WORDS.trigger,
    payload: [
        { name: "renderRowId", type: "id", description: RENDER_TRIGGER_WORDS.renderRowId, filterable: false },
        { name: "renderId", type: "id", description: RENDER_TRIGGER_WORDS.renderId, filterable: false },
        { name: "status", type: "choice", of: ["done", "failed"], description: RENDER_TRIGGER_WORDS.status, filterable: true },
    ],
    batching: { mode: "each" },
    recovery: "none",
    subject: { kind: "video-render", field: "renderId" },
    decided: false,
    onByDefault: true,
})

/** Every trigger a provider declares: the provider's level 3, in one place. */
export const PROVIDER_TRIGGERS: ReadonlyArray<ProviderTriggerDeclaration> = [
    ...BANK_FEED_PROVIDERS.map((provider) => bankTransactionOf(provider)),
    MAILBOX_MAIL,
    ...COMPOSE_PROVIDERS.map((provider) => renderCompletedOf(provider)),
]
