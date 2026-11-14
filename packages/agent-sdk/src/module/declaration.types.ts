import type { ActionDefinition, ReadDefinition } from "../block/block.types"
import type { JsonValue, Namespaced } from "../schema/schema.types"
import type { StoredSpec, SpecProblem } from "../spec/spec.types"

/** The default of one ability of a fresh agent: not held, used by itself, or used after a person approved the call. */
export type ModuleAbilityDefault = "off" | "auto" | "ask"

/** The default of each ability of a set, by the host's ability id (`customer.send`, `qr.create`); an ability left out is `off`. */
export type ModuleAbilityDefaults = Readonly<Record<string, ModuleAbilityDefault>>

/**
 * The default RIGHTS of a module's agent on the providers a workspace connected, as a fresh agent is proposed them (hard rights,
 * enforced by the host; soft policy is the truth graph). `kinds` speaks for every provider of a kind by the host's names (messaging, payment,
 * books); `providers` adds or replaces abilities for one provider by its key (`zalo_oa`). They are only the proposal at creation: once
 * an agent exists its rights are the workspace's, and no later version of this declaration changes them.
 */
export interface ModuleAgentAbilities {
    /** The default abilities on every provider of a kind. */
    readonly kinds?: Readonly<Record<string, ModuleAbilityDefaults>> | undefined
    /** The default abilities on one provider, over those of its kind. */
    readonly providers?: Readonly<Record<string, ModuleAbilityDefaults>> | undefined
}

/**
 * The agent of a module: the set of tools it may ever use. Its words (guidance, base mindset) are the module's craft, read by the
 * plugin's `guidance` function; they are no member of this declaration. A step of a workflow of the module declares
 * its own tools inside this set (step inside agent inside installed), which the engine checks when a workflow is saved or adopted.
 */
export interface ModuleAgent {
    /** Every effect and tool id a step of this module's agent may declare. */
    readonly tools: ReadonlyArray<string>
    /**
     * The default rights of a fresh agent on connected providers; absent for an agent that reaches no provider. Dead data for a module
     * that ships a template agent (`defineTemplateAgent`): the engine derives those defaults from the agent's accounts and its node steps.
     */
    readonly abilities?: ModuleAgentAbilities | undefined
}

/** The words of a contact block's title, in both product languages. */
interface ModuleContactBlockTitle {
    readonly vi: string
    readonly en: string
}

/** The generic block a contact block draws with: its registry id, the read slot it fills and its literal props. */
interface ModuleContactBlockDraw {
    readonly id: Namespaced
    readonly slot: string
    readonly props?: Readonly<Record<string, JsonValue>> | undefined
}

/**
 * One block a module mounts on the contact detail ("Tu module"): what the module knows about THIS person, drawn by a generic block the
 * workbench already renders over one read of the module. The read takes a `contactId` variable (the contact's id, merged-away ids
 * follow the survivor in the record store) and its record type has a `contact()` field; the read's own permission guards it.
 */
export interface ModuleContactBlock {
    /** The block's id within the module (lower-case kebab), unique among the module's contact blocks. */
    readonly id: string
    /** The words of the block's title, in both product languages. */
    readonly title: ModuleContactBlockTitle
    /** The id of a read of THIS module, taking a `contactId` variable. */
    readonly read: Namespaced
    /** The generic block that draws the read: its registry id, the read slot it fills and its literal props. */
    readonly block: ModuleContactBlockDraw
}

/** What `defineModule` takes: everything a module declares, as data. */
export interface ModuleDeclarationConfig {
    /** The agent of the module, when it has one: its tool set. */
    readonly agent?: ModuleAgent | undefined
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
    /**
     * The door tools the module's jobs and nodes call, by tool id `nivo.tool.<domain>.<object>.<verb>` (`nivo.tool.customer.message.send`,
     * `nivo.tool.ledger.entry.append`); the door resolves the workspace's provider, so a module never names one.
     */
    readonly tools?: ReadonlyArray<`${string}.${string}`>
    /** The seed specs of the module. */
    readonly specs: ReadonlyArray<StoredSpec>
    /** The blocks the module mounts on the contact detail; absent: none. */
    readonly contactBlocks?: ReadonlyArray<ModuleContactBlock> | undefined
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
