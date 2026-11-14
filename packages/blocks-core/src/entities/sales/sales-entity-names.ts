/**
 * The record types of the sales agent, named `<package>.<agent>.<domain>`. One constant per type, imported everywhere a type name is
 * needed, so a mismatch is a compile error.
 */

/** A customer the sales agent talks with. */
export const SALES_LEAD_ENTITY = "blocks-core.sales.lead"

/** An order a customer agreed to. */
export const SALES_ORDER_ENTITY = "blocks-core.sales.order"

/** The rules the workspace chose for its sales (the one record). */
export const SALES_SETTINGS_ENTITY = "blocks-core.sales.settings"

/** What a customer said about paying an order. */
export const SALES_CLAIM_ENTITY = "blocks-core.sales.claim"

/** One bank movement the shop's account reported, matched to the order it paid (the sale's payment). */
export const SALES_TRANSACTION_ENTITY = "blocks-core.sales.transaction"

/** An invoice issued for an order or a contract period (the books of the sale). */
export const SALES_INVOICE_ENTITY = "blocks-core.sales.invoice"

/** A correction of a booked amount. */
export const SALES_LEDGER_ADJUSTMENT_ENTITY = "blocks-core.sales.ledger-adjustment"

/** One entry of the books, projected from a transaction, an invoice or a correction. */
export const SALES_LEDGER_ENTRY_ENTITY = "blocks-core.sales.ledger-entry"

/** A question the books ask the owner. */
export const SALES_LEDGER_QUESTION_ENTITY = "blocks-core.sales.ledger-question"

/** The rules the workspace chose for its books (the one record). */
export const SALES_LEDGER_SETTINGS_ENTITY = "blocks-core.sales.ledger-settings"

/** A customer who collects points (the loyalty programme of the sale). */
export const SALES_LOYALTY_MEMBER_ENTITY = "blocks-core.sales.loyalty-member"

/** One move of a member's points. */
export const SALES_LOYALTY_LEDGER_ENTRY_ENTITY = "blocks-core.sales.loyalty-ledger-entry"

/** A reward members redeem points for. */
export const SALES_LOYALTY_REWARD_ENTITY = "blocks-core.sales.loyalty-reward"

/** The rules of the loyalty programme (the one record). */
export const SALES_LOYALTY_PROGRAM_ENTITY = "blocks-core.sales.loyalty-program"

/** A promotion sent to a segment of members. */
export const SALES_LOYALTY_CAMPAIGN_ENTITY = "blocks-core.sales.loyalty-campaign"

/** A loyalty step that waits for a person. */
export const SALES_LOYALTY_DECISION_ENTITY = "blocks-core.sales.loyalty-decision"
