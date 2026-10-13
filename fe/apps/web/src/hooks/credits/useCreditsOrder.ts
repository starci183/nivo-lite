import { useCallback } from "react"
import { qrUrlFor } from "@/lib/sepay"
import { writePaymentOrderRequest } from "@/modules/db/billing/write-payment-order-request"
import type { CreditsData, PayOrder } from "./credits.shared"

/** The catalogue keys that say why an order was refused. */
export type OrderErrorKey =
    | "errPack"
    | "errWorkspace"
    | "errPlan"
    | "errNotUpgrade"
    | "errRenewFirst"
    | "errZero"
    | "errForbidden"
    | "errGeneric"

const ERROR_KEYS: Readonly<Record<string, OrderErrorKey>> = {
    CREDITS_PACK_NOT_FOUND: "errPack",
    CREDITS_WORKSPACE_NOT_ACTIVE: "errWorkspace",
    CREDITS_PLAN_NOT_FOUND: "errPlan",
    CREDITS_NOT_UPGRADE: "errNotUpgrade",
    CREDITS_RENEW_FIRST: "errRenewFirst",
    CREDITS_ZERO_AMOUNT: "errZero",
    BILLING_FORBIDDEN: "errForbidden",
    BILLING_NOT_MEMBER: "errForbidden",
}

/** What the page asks to pay: a pack of credits or an upgrade to a plan. */
export interface OrderTarget {
    readonly kind: "topup" | "upgrade"
    /** The pack code or the plan code. */
    readonly code: string
}

/** The result of asking for an order: the order to pay, or the catalogue key of the refusal. */
export type PayOrderResult =
    { readonly kind: "ok"; readonly order: PayOrder } | { readonly kind: "failed"; readonly errorKey: OrderErrorKey }

const numberOf = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined)

/**
 * Asks the back end (through the request rpc and its job) for a top-up or an upgrade order of the workspace and shapes it for the
 * pay drawer. The price, the credits and the proration are the back end's; this only names the pack or the plan.
 */
export const useCreditsOrder = (
    workspaceId: string,
    bank: CreditsData["bank"],
): ((target: OrderTarget) => Promise<PayOrderResult>) =>
    useCallback(
        async (target) => {
            const result = await writePaymentOrderRequest({ workspaceId, kind: target.kind, target: target.code })
            if (result.kind !== "ok") return { kind: "failed", errorKey: ERROR_KEYS[result.code] ?? "errGeneric" }
            const order = result.value
            const credit = numberOf(order.detail.credit)
            const daysLeft = numberOf(order.detail.daysLeft)
            return {
                kind: "ok",
                order: {
                    id: order.id,
                    code: order.order_code,
                    amount: order.amount_vnd,
                    expiresAt: order.expires_at,
                    qrUrl: qrUrlFor(bank, order.amount_vnd, order.order_code),
                    ...(credit === undefined ? {} : { credit }),
                    ...(daysLeft === undefined ? {} : { daysLeft }),
                },
            }
        },
        [workspaceId, bank],
    )
