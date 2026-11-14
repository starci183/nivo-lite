import { Injectable } from "@nestjs/common"
import type { FactSpec } from "./agent-graphs.contracts"
import type { GraphFactReader } from "./agent-graphs.port"
import {
    OUTGOING_AMOUNT,
    OUTGOING_HAS_AMOUNT,
    OUTGOING_HAS_LINK,
    OUTGOING_HAS_PHONE,
    OUTGOING_LENGTH,
} from "./policies/outgoing-facts.policy"
import { MONEY_AMOUNT, MONEY_SOURCE, MONEY_VIA } from "./policies/money-facts.policy"

/** Whether the work names a customer. */
export const CUSTOMER_KNOWN = "customer.known"

/** The tool about to run, the connector it belongs to, and the department a handover goes to. */
const TOOL_NAME_FACT = "tool.name"
const TOOL_CONNECTOR_FACT = "tool.connector"
const HANDOVER_TO_FACT = "handover.to"

const specOf = (
    key: string,
    type: FactSpec["type"],
    unit: FactSpec["unit"] = null,
    notWorkAmount = false,
): FactSpec => ({
    key,
    type,
    unit,
    labelKey: `agentGraphs.fact.${key}`,
    ...(notWorkAmount ? { notWorkAmount } : {}),
})

const FACTS: ReadonlyArray<FactSpec> = [
    specOf(OUTGOING_AMOUNT, "number", "vnd", true),
    specOf(OUTGOING_HAS_AMOUNT, "boolean", null, true),
    specOf(OUTGOING_HAS_LINK, "boolean", null, true),
    specOf(OUTGOING_HAS_PHONE, "boolean", null, true),
    specOf(OUTGOING_LENGTH, "number", "count", true),
    specOf(MONEY_AMOUNT, "number", "vnd", true),
    specOf(MONEY_SOURCE, "string"),
    specOf(MONEY_VIA, "string"),
    specOf(CUSTOMER_KNOWN, "boolean"),
    specOf(TOOL_NAME_FACT, "string"),
    specOf(TOOL_CONNECTOR_FACT, "string"),
    specOf(HANDOVER_TO_FACT, "string"),
]

@Injectable()
/**
 * Declares the facts of what an agent is about to do (the text that would leave, the money of the turn, the customer, the call), for the
 * checks of a saved or published graph. Nothing reads their values: no engine gate walks a graph (2026-11-13).
 */
export class OutgoingFactReaderService implements GraphFactReader {
    /** The facts of the proposal itself. */
    readonly facts: ReadonlyArray<FactSpec> = FACTS
}
