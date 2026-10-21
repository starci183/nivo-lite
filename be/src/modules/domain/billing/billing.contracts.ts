import type { BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import type { BankAccountOptions } from "./billing.options"
import type { JsonObject } from "./webhook-body.policy"

/** The value of a request header: the text it carried, or undefined when it was absent. */
export type HeaderValue = string | undefined

/** The exact bytes of a request body, or undefined when the request carried none. */
export type RawBody = Buffer | undefined

/** A plan, or null when none matches. */
export type PlanLookup = Plan | null

/** The billing columns of a workspace, or null when it does not exist. */
export type WorkspaceLookup = WorkspaceBilling | null

/** The feature lists of a plan by language. */
export interface PlanFeatures {
    /** The Vietnamese feature lines. */
    readonly vi: ReadonlyArray<string>
    /** The English feature lines. */
    readonly en: ReadonlyArray<string>
}

/** One plan of the catalogue. */
export interface Plan {
    /** The plan code. */
    readonly code: string
    /** The Vietnamese name. */
    readonly nameVi: string
    /** The English name. */
    readonly nameEn: string
    /** The price of one period in VND. */
    readonly priceVnd: number
    /** The billing period. */
    readonly period: "month" | "year"
    /** The seats the plan includes. */
    readonly seats: number
    /** The feature lists by language. */
    readonly features: PlanFeatures
    /** The order of the catalogue. */
    readonly sort: number
    /** The monthly AI credits; null is unlimited. */
    readonly aiCreditsPerMonth: number | null
    /** A contract plan: shown, never bought in the app. */
    readonly isCustom: boolean
    /** The price of one year paid at once in VND; null when the plan has no annual price. */
    readonly priceAnnualVnd: number | null
    /** The share saved by paying a year at once, in percent; null when there is no annual price. */
    readonly annualDiscountPct: number | null
    /** The monthly price of the intro months in VND; null when the plan has no intro offer. */
    readonly promoPriceVnd: number | null
    /** How many paid months the intro price lasts; null when the plan has no intro offer. */
    readonly promoMonths: number | null
    /** The storage the plan includes in GB; null is not capped. */
    readonly storageGb: number | null
    /** One person only: the plan takes no invitations. */
    readonly individual: boolean
    /** The price is per seat. */
    readonly perSeat: boolean
    /** On sale to new customers; a plan that is not listed still works for the workspaces that have it. */
    readonly listed: boolean
    /** The per-seat credit levels of a per-seat plan (Team), smallest first; empty on every other plan. */
    readonly tiers: ReadonlyArray<PlanTier>
    /** The add-on credit packs bought on top of the plan's fixed allowance, smallest first; the plan price never changes with them. */
    readonly packs: ReadonlyArray<PlanTier>
}

/** One usage row: a per-seat credit level (Team) or an add-on pack, with its own price. */
export interface PlanTier {
    /** The credits: a month of one seat for a level, the credits added for a pack. */
    readonly creditsPerMonth: number
    /** The price in VND: a month of one seat for a level, the pack's own price for a pack. */
    readonly priceVnd: number
    /** The price is per seat. */
    readonly perSeat: boolean
}

/** How often a plan is paid. */
export type BillingCycle = "monthly" | "annual"

/** What a manager picked to buy on a plan. */
export interface PlanSelection {
    /** Pay month by month or a year at once. */
    readonly cycle: BillingCycle
    /** The per-seat credit level picked on a per-seat plan; null on every other plan. */
    readonly tierCredits: number | null
    /** The seats, for a per-seat plan. */
    readonly seats: number
}

/** What a caller may leave out of a selection: the plan's monthly base stands for it. */
export interface PlanSelectionInput {
    /** Pay month by month or a year at once. */
    readonly cycle?: BillingCycle | null
    /** The monthly allowance picked from the usage tiers. */
    readonly tierCredits?: number | null
    /** The seats, for a per-seat plan. */
    readonly seats?: number | null
}

/** The price of a plan selection, worked out on the server. */
export interface PlanQuote {
    /** The plan the quote is for. */
    readonly planCode: string
    /** The cycle priced. */
    readonly cycle: BillingCycle
    /** Months the payment covers. */
    readonly months: number
    /** The amount to transfer in VND. */
    readonly amountVnd: number
    /** The full monthly price of the selection in VND, before any intro offer or annual saving. */
    readonly listMonthlyVnd: number
    /** The intro price applies to this payment. */
    readonly promo: boolean
    /** The monthly allowance picked, or null for the plan's own. */
    readonly tierCredits: number | null
    /** The seats paid. */
    readonly seats: number
    /** The credits a month the workspace gets (all seats together). */
    readonly creditsPerMonth: number | null
}

/** The storage a workspace keeps against what its plan includes. */
export interface WorkspaceStorage {
    /** Bytes in the knowledge and media buckets. */
    readonly usedBytes: number
    /** Bytes the plan includes; null is not capped. */
    readonly quotaBytes: number | null
}

/** The billing columns of one workspace. */
export interface WorkspaceBilling {
    /** The status. */
    readonly status: string
    /** The plan code, or null before the first payment. */
    readonly planCode: string | null
    /** The end of the paid period, ISO 8601, or null. */
    readonly paidUntil: string | null
    /** The monthly allowance the workspace picked from the usage tiers, or null for the plan's own. */
    readonly tierCredits: number | null
    /** The paid seats of a per-seat plan, or null when seats are not tracked. */
    readonly seatCount: number | null
    /** How the workspace pays, or null before the first payment. */
    readonly billingCycle: BillingCycle | null
    /** The full monthly price of what the workspace bought in VND, or null. */
    readonly billedMonthlyVnd: number | null
}

/** Billing state of one workspace with the caller's active membership. */
export interface BillingWorkspace extends WorkspaceBilling {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
    /** The caller's role in the workspace. */
    readonly role: string
}

/** The workspace a renewal asks for. */
export interface RenewalParams {
    /** The workspace to renew. */
    readonly workspaceId: string
}

/** The first payment a workspace asks for. */
export interface PlanOrderParams {
    /** The workspace to pay for. */
    readonly workspaceId: string
    /** The plan to buy. */
    readonly planCode: string
    /** What was picked on the plan; the plan's monthly base for whatever is left out. */
    readonly selection?: PlanSelectionInput
}

/** An order together with what the customer needs to pay it. */
export interface PayableOrder {
    /** The order. */
    readonly order: PaymentOrder
    /** The VietQR image that pays the order into the bank account. */
    readonly qrUrl: string
    /** The bank account the transfer goes to. */
    readonly bank: BankAccountOptions
}

/** SePay's webhook body reduced to the fields NIVO reads (names exactly as in https://docs.sepay.vn); only `id` is required. */
export interface SepayPayload {
    /** SePay's own transaction id: the idempotency key. */
    readonly id: number
    /** The bank gateway name. */
    readonly gateway: string | undefined
    /** `in` for a credit, `out` for a debit. */
    readonly transferType: string | undefined
    /** The amount in VND; 0 when absent, undefined when unreadable. */
    readonly transferAmount: number | undefined
    /** The transfer content. */
    readonly content: string | null
    /** The payment code SePay extracted from the content. */
    readonly code: string | null
    /** SePay's description line. */
    readonly description: string | null
}

/** A delivery to NIVO's own billing door: SePay's key and the exact bytes it posted. */
export interface SepayDelivery {
    /** The `Authorization` header. */
    readonly authorization: HeaderValue
    /** The exact bytes of the body. */
    readonly rawBody: RawBody
}

/** A delivery to a workspace's own SePay feed. */
export interface SepayFeedDelivery extends SepayDelivery {
    /** The connection id from the url. */
    readonly connectionId: string
}

/** A delivery to a workspace's Casso feed. */
export interface CassoDelivery {
    /** The connection id from the url. */
    readonly connectionId: string
    /** The exact bytes of the body. */
    readonly rawBody: RawBody
    /** The `X-Casso-Signature` header of webhook V2. */
    readonly signature: HeaderValue
    /** The `secure-token` header of webhook V1. */
    readonly secureToken: HeaderValue
}

/** A delivery to a workspace's payOS feed. */
export interface PayosDelivery {
    /** The connection id from the url. */
    readonly connectionId: string
    /** The exact bytes of the body. */
    readonly rawBody: RawBody
}

/** A connection whose webhook delivery proved itself. */
export interface ProvenConnection {
    /** The connection id from the delivery url. */
    readonly connectionId: string
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
}

/** A delivery whose sender is proven: the connection it is for and the JSON object that was signed. */
export interface ProvenDelivery {
    /** The connection the delivery is for. */
    readonly connection: ProvenConnection
    /** The parsed JSON body. */
    readonly body: JsonObject
}

/** The proof of a payOS delivery: a proven payment, or the confirmation ping that is acknowledged and never booked. */
export type PayosProof = ({ readonly kind: "proven" } & ProvenDelivery) | { readonly kind: "sample" }

/** Frozen top-up and upgrade figures exposed with a payment order. */
export interface BillingPaymentDetails {
    /** Frozen credits figure; null when this order does not carry it. */
    readonly credits: number | null
    /** Frozen from figure; null when this order does not carry it. */
    readonly from: string | null
    /** Frozen to figure; null when this order does not carry it. */
    readonly to: string | null
    /** Frozen fromPrice figure; null when this order does not carry it. */
    readonly fromPrice: number | null
    /** Frozen toPrice figure; null when this order does not carry it. */
    readonly toPrice: number | null
    /** Frozen credit figure; null when this order does not carry it. */
    readonly credit: number | null
    /** Frozen daysLeft figure; null when this order does not carry it. */
    readonly daysLeft: number | null
    /** Frozen paidUntil figure; null when this order does not carry it. */
    readonly paidUntil: string | null
    /** The cycle a plan order was sold for; null when this order does not carry it. */
    readonly cycle: string | null
    /** The monthly allowance picked on a plan order; null when it carries none. */
    readonly tierCredits: number | null
    /** The seats of a per-seat plan order; null when it carries none. */
    readonly seats: number | null
    /** The intro price was applied to a plan order; null when this order does not carry it. */
    readonly promo: boolean | null
}

/** A payment order normalized for the customer payment screen. */
export interface BillingPaymentOrder extends Omit<PaymentOrder, "detail"> {
    /** Frozen sale details. */
    readonly detail: BillingPaymentDetails
    /** Backend computed VietQR image URL. */
    readonly qrUrl: string
    /** Public receiving account details. */
    readonly bank: BankAccountOptions
}

/** A normalized payment order, or null when the scoped order does not exist. */
export type BillingPaymentOrderLookup = BillingPaymentOrder | null

/** Money an owner or manager knows arrived, entered by hand. */
export interface ManualCredit {
    /** Whole dong, greater than zero. */
    readonly amount: number
    /** The day the money arrived, yyyy-mm-dd. */
    readonly date: string
    /** What the transfer said. */
    readonly content: string
    /** A note, when the person added one. */
    readonly note?: string
    /** The payer, when the person named one. */
    readonly payer?: string
}

/**
 * What the bank feed answered for one move of a committed receipt: `booked` recorded a live payment event and queued its
 * reconcile job, `debited` recorded money that left the account as a debit transaction, `duplicate` counted a repeat, `unbound`
 * remembered the move on the connection because no accounting agent is bound, and `refused` with `test_environment` kept a
 * move of a provider test connection out of every business table.
 */
export type FeedCreditAnswer =
    | { readonly status: "booked" | "debited" | "duplicate" | "unbound" }
    | { readonly status: "refused"; readonly code: "test_environment" }

/** The workspace providers admitted by the bank-feed receipt job. */
export type BankFeedProvider = BankFeedDeliveryRecorded["provider"]
