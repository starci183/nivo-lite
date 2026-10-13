"use server"
import "server-only"

import { setTimeout as sleep } from "node:timers/promises"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toPaymentOrder } from "./billing.mapper"
import type { PaymentOrder } from "./billing.mapper"
import { paymentOrderRequestSchema } from "./billing-validation.mapper"

/** How many times the action looks for the back end's answer, and how long it waits between looks. */
const ANSWER_LOOKS = 38
const ANSWER_POLL_MS = 400

/** Reads the request row until the back end has answered it or the looks run out. */
const awaitAnswer = async (
    client: SupabaseClient<Database>,
    requestId: string,
    looksLeft: number,
): Promise<DbOutcome<PaymentOrder>> => {
    if (looksLeft === 0) return dbFailure("unavailable", "timeout")
    const answer = toOutcome(
        await client.from("payment_order_requests").select("status, order_id, fault").eq("id", requestId).maybeSingle(),
    )
    if (answer.kind !== "ok") return answer
    if (answer.value.status === "failed") return dbFailure("invalid", answer.value.fault ?? "failed")
    if (answer.value.status === "done" && answer.value.order_id !== null) {
        const order = toOutcome(
            await client.from("payment_orders").select("*").eq("id", answer.value.order_id).maybeSingle(),
        )
        return order.kind === "ok" ? dbOk(toPaymentOrder(order.value)) : order
    }
    await sleep(ANSWER_POLL_MS)
    return awaitAnswer(client, requestId, looksLeft - 1)
}

/**
 * Asks for a payment order (first payment, renewal, credit pack or upgrade) and waits for the answer. Prices, codes and the
 * proration are made by the back end from the database, never taken from the browser: the member only names what to buy.
 * The `payment_order_request` rpc proves owner or manager and queues the job; the job answers the request row, which the
 * manager reads under RLS. A refusal of the back end arrives as `invalid` with its error code.
 */
export const writePaymentOrderRequest = async (input: unknown): Promise<DbOutcome<PaymentOrder>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = paymentOrderRequestSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "payment-order-request-input")
    const client = await createServerDbClient()
    const requested = toOutcome(
        await client.rpc("payment_order_request", {
            p_workspace: parsed.data.workspaceId,
            p_kind: parsed.data.kind,
            p_target: parsed.data.target,
        }),
    )
    return requested.kind === "ok" ? awaitAnswer(client, requested.value, ANSWER_LOOKS) : requested
}
