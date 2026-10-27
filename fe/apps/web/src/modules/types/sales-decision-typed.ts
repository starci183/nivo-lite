/** What a person has typed or toggled on the pending cards, by decision id. */
export interface TypedDecisionValues {
    readonly editing: Readonly<Record<string, boolean>>
    readonly drafts: Readonly<Record<string, string>>
    readonly amounts: Readonly<Record<string, string>>
    readonly values: Readonly<Record<string, string>>
}
