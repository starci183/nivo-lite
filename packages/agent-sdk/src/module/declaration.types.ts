import type { ActionDefinition, ReadDefinition } from "../block/block.types"
import type { StoredSpec, SpecProblem } from "../spec/spec.types"

/** What `defineModule` takes: everything a module declares, as data. */
export interface ModuleDeclarationConfig {
    /** The module key, short lowercase ASCII; every read and action id starts with `<key>.`. */
    readonly key: string
    /** The message namespace of the module. */
    readonly namespace: string
    /** The permissions the module declares; a read, an action or a spec `when` names only these. */
    readonly permissions: ReadonlyArray<string>
    /** The reads of the module, host-operation or running in the package. */
    readonly reads: ReadonlyArray<ReadDefinition>
    /** The actions of the module. */
    readonly actions: ReadonlyArray<ActionDefinition>
    /** The tools the module's graph nodes may call, as `<group>.<provider>.<action>`. */
    readonly tools?: ReadonlyArray<`${string}.${string}.${string}`>
    /** The seed specs of the module. */
    readonly specs: ReadonlyArray<StoredSpec>
}

/** A module declaration, as the registry holds it after `defineModule` checked it. */
export interface ModuleDeclaration extends ModuleDeclarationConfig {
    /** Tells a module declaration from the other registry entries. */
    readonly entry: "module"
}

/** What is wrong with one seed spec of a module. */
export interface SeedSpecProblem {
    /** The index of the spec in the module's `specs`. */
    readonly spec: number
    /** The problems `specProblems` found against the module's reads, actions and permissions. */
    readonly problem: SpecProblem
}
