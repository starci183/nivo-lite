import { defineJob, workflowPort } from "@nivo-lite/agent-sdk/mutation"
import type { JobDefinition, WorkflowApi } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { creditsNamingCode, sinceOf } from "../../../rules/accounting/rematch"
import { orderById, unmatchedCreditsSince, workspaceSettings } from "../accounting-data"
import { ORDERS, SETTINGS, TRANSACTIONS } from "../ports"

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "payment.rematch"

/** The workflow every transfer goes to. */
const RECONCILE = { moduleKey: "accounting", workflow: "reconcile" } as const

/** The key that makes one credit start the reconciliation once per order. */
export const rematchKeyOf = (transactionId: string, orderId: string): string => `rematch:${transactionId}:${orderId}`

/** How many times the queue delivers the job before it is parked. */
const ATTEMPTS = 5

/** The most credits one sweep looks at. */
export const REMATCH_SWEPT = 100

const input: z.ZodObject<{ orderId: z.ZodUUID; at: z.ZodString }> = z.object({
    orderId: z.uuid(),
    at: z.string().min(1).max(40),
})

/** The port definitions of the job, by the name `run` reaches them by. */
type RematchPorts = {
    /** The payments. */
    readonly transactions: PortDefinition<EntityApi>
    /** The orders. */
    readonly orders: PortDefinition<EntityApi>
    /** The rules the workspace chose, which say how many days back a code looks. */
    readonly settings: PortDefinition<EntityApi>
    /** The start of a workflow run. */
    readonly workflow: PortDefinition<WorkflowApi>
}

const ports: RematchPorts = { transactions: TRANSACTIONS, orders: ORDERS, settings: SETTINGS, workflow: workflowPort }

/**
 * `payment.rematch`: a payment code was just issued for an order, so the credits that arrived BEFORE the code existed and name it are
 * looked for, in the unmatched credits of the workspace's last `rematchDays` (counted back from `at`, the instant the code was issued).
 * It does no business: it never pays an order, never judges an amount and never asks the owner. For each credit found it starts the
 * reconciliation workflow again (the first run, when the credit arrived, found no order because the order had no code yet); the agent
 * of that workflow is the only path that pays an order, and settle's guards stop a second run from paying twice. The start is keyed
 * `rematch:<transactionId>:<orderId>`, so a credit is handed over once per order however often the job is delivered. It writes nothing.
 */
export const rematchJob: JobDefinition<typeof input, RematchPorts> = defineJob({
    name: JOB_NAME,
    input,
    ports,
    attempts: ATTEMPTS,
    run: async ({ transactions, orders, settings, workflow }, given) => {
        const order = await orderById(orders, given.orderId)
        if (order === null) return
        const days = (await workspaceSettings(settings)).rematchDays
        const credits = creditsNamingCode(
            order,
            await unmatchedCreditsSince(transactions, sinceOf(given.at, days), REMATCH_SWEPT),
        )
        for (const credit of credits)
            await workflow.start({
                moduleKey: RECONCILE.moduleKey,
                workflow: RECONCILE.workflow,
                version: "latest",
                inputs: { transactionId: credit.id },
                dedupeKey: rematchKeyOf(credit.id, order.id),
            })
    },
})
