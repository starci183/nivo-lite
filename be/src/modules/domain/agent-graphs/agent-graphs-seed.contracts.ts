/** A text in both product languages, as the catalogue holds it. */
export interface SeedText {
    /** The Vietnamese text. */
    readonly vi: string
    /** The English text. */
    readonly en: string
}

/** A module as the base graph reads it; `ModuleDefinition` fits. */
export interface SeedModule {
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: SeedText
    /** The connection providers. */
    readonly connectionProviders: ReadonlyArray<string>
}
