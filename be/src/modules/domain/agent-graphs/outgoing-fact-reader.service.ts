import { Injectable } from "@nestjs/common"
import { HANDOVER_TO_FACT, TOOL_CONNECTOR_FACT, TOOL_NAME_FACT } from "@modules/domain/authority-rules"
import type { FactSpec, FactValues } from "./agent-graphs.contracts"
import type { FactSubject, GraphFactReader } from "./agent-graphs.port"
import {
    OUTGOING_AMOUNT,
    OUTGOING_HAS_AMOUNT,
    OUTGOING_HAS_LINK,
    OUTGOING_HAS_PHONE,
    OUTGOING_LENGTH,
    OUTGOING_SAYS_RECEIVED,
    outgoingFactsOf,
} from "./policies/outgoing-facts.policy"
import { MONEY_AMOUNT, MONEY_SOURCE, MONEY_VIA, moneyFactsOf } from "./policies/money-facts.policy"

/** Whether the work names a customer. */
export const CUSTOMER_KNOWN = "customer.known"

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
    specOf(OUTGOING_SAYS_RECEIVED, "boolean", null, true),
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
 * The facts of what an agent is about to do, computed by the backend for any action and any agent: from the text that would really
 * leave, the record of the work, and the call the road is about to make. None comes from the model. A fact the work does not hold
 * is left out, so a condition on it falls to the `else`, which never runs alone.
 */
export class OutgoingFactReaderService implements GraphFactReader {
    /** The facts of the proposal itself. */
    readonly facts: ReadonlyArray<FactSpec> = FACTS

    /** Reads the facts asked for from the subject, with no call out. */
    read(_workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<FactValues> {
        const known = subject.leadId === undefined ? {} : { [CUSTOMER_KNOWN]: subject.leadId !== null }
        const read: FactValues = {
            ...outgoingFactsOf(subject.text),
            ...moneyFactsOf(subject.evidence, subject.amountVnd),
            ...known,
            ...subject.attributes,
        }
        return Promise.resolve(Object.fromEntries(facts.flatMap((fact) => (fact in read ? [[fact, read[fact]]] : []))))
    }
}
