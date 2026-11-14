/** One API key row, already in the reader's words. */
export interface ApiKeyRowView {
    readonly id: string
    readonly name: string
    /** "MCP key" or "Public API key". */
    readonly kindLabel: string
    readonly scopeText: string
    /** The words before the key's visible start ("Starts with"); the start itself is `prefixCode`, an identifier shown verbatim. */
    readonly prefixLead: string
    /** The visible start of the key (`nvk_4b20cd82…`): the one thing that tells two keys apart, drawn as code. */
    readonly prefixCode: string
    readonly detailText: string
    readonly statusLabel: string
    readonly isRevoked: boolean
    /** True while a working key is suspended because its holder is no longer an owner or manager (or left). */
    readonly isInactive: boolean
}
