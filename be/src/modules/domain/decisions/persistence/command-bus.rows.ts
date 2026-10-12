/** The agent a command sender id names. */
export interface SenderAgentRow {
    /** The agent name. */
    name: string
    /** The module it belongs to. */
    module: string
    /** The installation name of the agent, null for an agent that is not an installed instance. */
    installation_name: string | null
}

/** Where a work item sits in its chain. */
export interface ParentPositionRow {
    /** The item. */
    id: string
    /** Its chain. */
    chain_id: string | null
    /** Its depth. */
    depth: number
}

/** The depth of the deepest item of a chain. */
export interface ChainTopRow {
    /** The depth. */
    depth: number
}

/** The answer of the cycle probe. */
export interface RepeatsRow {
    /** True when the chain already ran the command on the subject. */
    repeats: boolean
}

/** The readable label of a command subject. */
export interface SubjectLabelRow {
    /** The order number, customer name or invoice number. */
    label: string | null
}

/** An installation of a module. */
export interface GivenInstallationRow {
    /** The installation. */
    id: string
    /** Its name. */
    name: string
}

/** How the database resolved the installation of a command. */
export interface ResolvedInstallationRow {
    /** The installation. */
    installation_id: string
    /** Which rule chose it. */
    via: string
    /** Its name. */
    name: string | null
}
