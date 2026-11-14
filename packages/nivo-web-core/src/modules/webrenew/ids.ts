/**
 * The hand-off targets of the Renewal agent's graphs that other modules own: the agent by its module key and the workflow by its slug,
 * as `core.call-workflow` names them. Not built in this module.
 */
export const TARGETS = {
    /** The Accounting agent (`webbooks`), designed as G13 (match a renewal payment) and G9 (invoice after a renewal). */
    books: "webbooks",
    /** G13: matches the customer's transfer with a renewal request and records the payment. */
    payment: "payment",
    /** G9: drafts and issues the invoice of a renewal. */
    invoice: "invoice",
} as const
