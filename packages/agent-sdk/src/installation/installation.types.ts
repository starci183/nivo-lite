import type { BlockDefinition } from "../block/block.types"
import type { ModuleDeclaration } from "../module/declaration.types"
import type { NodeDefinition } from "../node/node.types"

/** What the installation needs of a job: a name, `<module>.<job>`. The job runner's definition type satisfies it. */
export interface InstalledJob {
    /** Tells a job from the other lists of the installation. */
    readonly entry: "job"
    /** `<module>.<job>`. */
    readonly name: string
}

/** What the installation needs of an entity: a name, `<module>.<thing>`. The entity engine's definition type satisfies it. */
export interface InstalledEntity {
    /** Tells an entity from the other lists of the installation. */
    readonly entry: "entity"
    /** `<module>.<thing>`. */
    readonly name: string
}

/** One package's lists: whatever the package contributes to the installation, each list optional. */
export interface InstallationPart<J extends InstalledJob = InstalledJob, E extends InstalledEntity = InstalledEntity> {
    /** The modules the package declares. */
    readonly modules?: ReadonlyArray<ModuleDeclaration>
    /** The blocks the package defines, React-free. */
    readonly blocks?: ReadonlyArray<BlockDefinition>
    /** The graph nodes the package defines. */
    readonly nodes?: ReadonlyArray<NodeDefinition>
    /** The jobs the package declares. */
    readonly jobs?: ReadonlyArray<J>
    /** The entities the package declares. */
    readonly entities?: ReadonlyArray<E>
}

/** What the installation holds of one kind of thing, for the hash and the refusals. */
export type InstallationKind = "module" | "block" | "read" | "action" | "node" | "job" | "entity"

/** Everything installed: the lists of every package, joined, and the hash of what they hold. */
export interface Installation<J extends InstalledJob = InstalledJob, E extends InstalledEntity = InstalledEntity> {
    /** Every module declaration, in part order. */
    readonly modules: ReadonlyArray<ModuleDeclaration>
    /** Every block definition, in part order. */
    readonly blocks: ReadonlyArray<BlockDefinition>
    /** Every node definition, in part order. */
    readonly nodes: ReadonlyArray<NodeDefinition>
    /** Every job, in part order. */
    readonly jobs: ReadonlyArray<J>
    /** Every entity, in part order. */
    readonly entities: ReadonlyArray<E>
    /** The sha-256 hex the generator computed over `registryLinesOf` of the lists; the back end serves its own for comparison. */
    readonly registryHash: string
}
