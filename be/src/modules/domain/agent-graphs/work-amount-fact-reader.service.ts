import { Injectable } from "@nestjs/common"
import type { FactSpec, FactValues } from "./agent-graphs.contracts"
import type { FactSubject, GraphFactReader } from "./agent-graphs.port"

/** The amount of an order a customer asks for: what a decide point on a chat or sales agent compares with a limit. */
export const ORDER_AMOUNT = "order.amount_vnd"

/**
 * The actions of the modules that hold an amount limit and name no fact of their own: their base graph reads
 * `<action>.amount_vnd`, so each is a fact the registry must declare or the seeded decide point would hold a condition nobody can read.
 */
const LIMITED_ACTIONS: ReadonlyArray<string> = [
    "send_quote",
    "confirm_order",
    "give_discount",
    "issue_invoice",
    "reconcile_payment",
    "cancel_with_fee",
    "send_purchase_order",
    "quote_custom_price",
    "redeem_reward",
]

const amountSpec = (key: string): FactSpec => ({
    key,
    type: "number",
    unit: "vnd",
    labelKey: `agentGraphs.fact.${key}`,
})

/** The facts of the amount of the work itself, in dong. */
const AMOUNT_FACTS: ReadonlyArray<FactSpec> = [ORDER_AMOUNT, ...LIMITED_ACTIONS.map((action) => `${action}.amount_vnd`)].map(
    amountSpec,
)

@Injectable()
/**
 * Declares, for the action graph, the amount of the work item a decide point judges (an order, a quote, a discount) and reads it
 * from the item. No record outside the item holds that amount, so this is what the gate reads today (`proposal.amount_vnd`) and the
 * graph adds no trust the gate did not already give it: a work item that names no amount leaves the fact absent and its branch
 * falls to the `else`, which never runs alone. A module that keeps a record of the amount declares a reader of its own beside this.
 */
export class WorkAmountFactReaderService implements GraphFactReader {
    /** The amount facts: the order, and the amount of each action that holds a limit. */
    readonly facts: ReadonlyArray<FactSpec> = AMOUNT_FACTS

    /** Reads the amount the work item proposes, for every amount fact asked. */
    read(_workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<FactValues> {
        const amount = subject.amountVnd
        if (typeof amount !== "number") return Promise.resolve({})
        return Promise.resolve(Object.fromEntries(facts.map((fact) => [fact, amount])))
    }
}
