/** The messages of one module in both product languages. */
export interface ModuleMessages {
    /** The Vietnamese words by key. */
    readonly vi: Readonly<Record<string, string>>
    /** The English words by key. */
    readonly en: Readonly<Record<string, string>>
}
