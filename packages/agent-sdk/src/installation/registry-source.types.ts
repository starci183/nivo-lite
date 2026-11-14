/**
 * The lists of an installation part, by the key of `InstallationPart`; `plugin` is the whole part, the ONE value a package built with
 * `definePlugin` exports (its other lists are then read from it, and a `blocks` list beside it only feeds the client renderers).
 */
export type RegistryListKey = "plugin" | "modules" | "blocks" | "nodes" | "jobs" | "entities"

/** One export of a package that holds a list of the installation. */
export interface RegistryList {
    /** Which list of the part it fills. */
    readonly key: RegistryListKey
    /** The import specifier of the package entry the list is exported from. */
    readonly from: string
    /** The exported name. */
    readonly name: string
}

/** The export of a package's client entry that lists the renderers of its blocks. */
export interface RegistryRenderers {
    /** The import specifier of the client entry. */
    readonly from: string
    /** The exported name of the renderer list. */
    readonly name: string
}

/** One installed package as the generator found it: the lists it exports and the renderers of its blocks. */
export interface RegistryPackage {
    /** The plugin key of a package that exports named lists and no `plugin` value (its package name without the scope); absent: none. */
    readonly key?: string | undefined
    /** The lists the package contributes, in the order of the part. */
    readonly lists: ReadonlyArray<RegistryList>
    /** The renderers of the package's blocks; null for a package that draws nothing. */
    readonly renderers: RegistryRenderers | null
}
