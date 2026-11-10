import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import type { NodeSchema } from "../node-schema.types"

/** The settled payment to write down: the bank transaction and the order it paid. */
export interface PostPaymentInput {
    readonly transactionId: string
    readonly orderId: string
}

/** The line the ledger wrote. */
export interface PostPaymentOutput {
    /** The provider's reference to the line, as `ledger.append` answered it. */
    readonly ref: string
}

const LEDGER_APPEND = TOOL.ledgerAppend

const id = z.string().min(1).max(MAX_ID)

const input: NodeSchema<PostPaymentInput> = z.object({ transactionId: id, orderId: id })

const output: NodeSchema<PostPaymentOutput> = z.object({
    ref: z.string().min(1).max(MAX_LINE).describe("The reference ledger.append answered for the line it wrote."),
})

const MAX_TURNS = 3

/** The grant of the examples: the ledger tool. */
const GRANT: RightsGrant = { rights: [], tools: [LEDGER_APPEND] }

/**
 * `accounting.post-payment` (Ghi sổ): the agent writes the settled payment into the shop's ledger by calling `ledger.append` with the
 * transaction id; the tool builds the line from the records (date, order, customer, amount) and writes a transaction once,
 * however often it is asked. A refused connection comes back to the agent as a fact and it says it cannot finish: the engine tells the
 * team and the workflow waits.
 */
export const accountingPostPaymentNode: NodeDefinition<
    NodeSchema<PostPaymentInput>,
    NodeSchema<PostPaymentOutput>,
    z.ZodObject<Record<string, never>>
> = defineNode({
    id: "accounting.post-payment",
    role: "output",
    title: bilingualOf("nodeAccountingPostPaymentTitle"),
    params: z.object({}),
    input,
    output,
    rights: [],
    effects: [],
    tools: [LEDGER_APPEND],
    requires: [LEDGER_APPEND],
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: messageOf("en", "nodeAccountingPostPaymentGoal"),
            input: given,
            output,
            maxTurns: MAX_TURNS,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "writes the 5,000 transaction that paid Dinh's order into the ledger, by its transaction id",
            grant: GRANT,
            params: {},
            input: { transactionId: "tx-95958515", orderId: "order-dinh" },
            model: [
                { call: { tool: LEDGER_APPEND, args: { transactionId: "tx-95958515" } } },
                { done: { ref: "Ledger!A2:G2" } },
            ],
            tools: [{ ref: "Ledger!A2:G2" }],
            output: { ref: "Ledger!A2:G2" },
            effects: [],
        },
    ],
})
