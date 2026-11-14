import type { AgentOption, Purpose } from "@/modules/types"

/** One entry of the back end answer: an active agent that may be bound, and what it would do there. */
export interface BindableWire {
    readonly agentId: string
    readonly purpose: string
}

/** What a bound agent does through a connection: the purposes the installation hands out (a lead source is not one of them). */
export type BindablePurpose = Exclude<Purpose, "lead_source">

/** An agent a connection of one provider may be bound to, with what it would do there. */
export interface BindableAgentOption extends AgentOption {
    readonly purpose: BindablePurpose
}

const PURPOSES: ReadonlyArray<BindablePurpose> = ["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool"]

const KNOWN_PURPOSES: ReadonlySet<string> = new Set(PURPOSES)

/** Whether a purpose of the back end answer is one the console knows. */
const isBindablePurpose = (purpose: string): purpose is BindablePurpose => KNOWN_PURPOSES.has(purpose)

/**
 * The workspace agents the back end says may be bound to a connection of the provider, in the order of `agents`, each with its
 * purpose. An agent the answer does not name, or names with a purpose the console does not know, is not offered: the front end holds
 * no table of its own.
 */
export const bindableOf = (
    agents: ReadonlyArray<AgentOption>,
    answer: ReadonlyArray<BindableWire>,
): ReadonlyArray<BindableAgentOption> => {
    const purposeOf = new Map(answer.map((entry) => [entry.agentId, entry.purpose]))
    return agents.flatMap((agent) => {
        const purpose = purposeOf.get(agent.id)
        return purpose !== undefined && isBindablePurpose(purpose) ? [{ ...agent, purpose }] : []
    })
}
