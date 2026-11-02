import type { IntentBusiness } from "@modules/domain/intent-contracts"
import type { GraphDocument } from "../agent-graphs.contracts"

/**
 * The graph a confirmed contract proposal makes: the business half of the intent is set in the document, replacing the one it had.
 * Null when the graph already holds exactly that, so a proposal that changes nothing is overtaken and never published as a new version.
 * Nothing here widens what the agent may do: a contract only tells the model more, the back end enforces the same.
 */
export const applyContract = (document: GraphDocument, business: IntentBusiness): GraphDocument | null => {
    const held = document.contracts ?? []
    const current = held.find((entry) => entry.intent === business.intent)
    if (current !== undefined && JSON.stringify(current) === JSON.stringify(business)) return null
    const contracts =
        current === undefined
            ? [...held, business]
            : held.map((entry) => (entry.intent === business.intent ? business : entry))
    return { ...document, contracts }
}
