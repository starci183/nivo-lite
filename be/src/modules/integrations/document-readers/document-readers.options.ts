/** Composition options of the document readers: they read no environment. */
export interface DocumentReadersOptions {
    /** Makes the port available to every domain. */
    readonly isGlobal?: boolean
}
