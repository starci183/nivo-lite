import type { NewAgent } from "./agents.contracts"

/** The role an agent is named by when no name is given: its default name is "Agent <label> #<generated id>". */
export interface DefaultAgentName {
    /** The role label in the owner's language ("Chatbot", "Sales", "Accounting"). */
    readonly label: string
}

/** What adding an agent takes: a typed display name, or the role its default name is made from. */
export interface NewNamedAgent extends Omit<NewAgent, "name"> {
    /** The display name, or the role its default name is made from. */
    readonly name: string | DefaultAgentName
}
