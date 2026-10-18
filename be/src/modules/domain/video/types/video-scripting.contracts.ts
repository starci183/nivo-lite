/** JSON string scanner state after consuming one quoted character. */
export interface VideoScriptQuoteState {
    /** Whether the scanner remains inside the quoted string. */
    readonly quoted: boolean
    /** Whether the next character is escaped. */
    readonly escaped: boolean
}
