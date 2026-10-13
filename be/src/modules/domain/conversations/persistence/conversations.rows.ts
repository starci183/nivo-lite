/** The front-door agent of a connection. */
export interface FrontAgentRow {
    /** The agent id. */
    readonly id: string
    /** The greeting that opens a visit. */
    readonly greeting: string
}

/** The owner's holding line, null when none is set. */
export interface HoldingSettingRow {
    /** The configured text. */
    readonly holding_message: string | null
}
