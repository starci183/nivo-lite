import { Injectable } from "@nestjs/common"
import type { FactSpec, FactSubject, FactValues, GraphFactReader } from "@modules/domain/agent-graphs"
import { OrdersService } from "./orders.service"

/** The amount of an order, and of the confirmation of one: what a decide point compares with a limit. */
export const ORDER_AMOUNT = "order.amount_vnd"
export const CONFIRM_ORDER_AMOUNT = "confirm_order.amount_vnd"

const specOf = (key: string): FactSpec => ({ key, type: "number", unit: "vnd", labelKey: `agentGraphs.fact.${key}` })

@Injectable()
/**
 * Reads, for the action graph, the amount of an order from the order record and never from what a proposal says. A record, or an amount,
 * that is missing leaves the fact out, so the branch falls to its else. This is what was ordered, and it is never taken for paid.
 */
export class OrderFactReaderService implements GraphFactReader {
    /** The amount facts of an order. */
    readonly facts: ReadonlyArray<FactSpec> = [specOf(ORDER_AMOUNT), specOf(CONFIRM_ORDER_AMOUNT)]

    constructor(private readonly orders: OrdersService) {}

    /** Reads the amount of the order of the subject, for every fact asked. */
    async read(workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<FactValues> {
        if (subject.type !== "order" || subject.id === "") return {}
        const order = await this.orders.find(workspaceId, subject.id)
        const amount = order?.amount_vnd
        return typeof amount === "number" ? Object.fromEntries(facts.map((fact) => [fact, amount])) : {}
    }
}
