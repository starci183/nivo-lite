import type { ActionDefinition, ReadDefinition } from "../block/block.types"
import type { StoredSpec, SpecProblem } from "../spec/spec.types"

/** The default of one ability of a fresh agent: not held, used by itself, or used after a person approved the call. */
export type ModuleAbilityDefault = "off" | "auto" | "ask"

/** The default of each ability of a set, by the host's ability id (`customer.send`, `qr.create`); an ability left out is `off`. */
export type ModuleAbilityDefaults = Readonly<Record<string, ModuleAbilityDefault>>

/**
 * The default RIGHTS of a module's agent on the providers a workspace connected, as a fresh agent is proposed them (hard rights,
 * enforced by the host; never the soft `policy`). `kinds` speaks for every provider of a kind by the host's names (messaging, payment,
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
 * The policy of a module's agent, in two halves. `limits` are numbers the tools read and enforce (an approval threshold, a
 * tolerance): the declaration holds the defaults, a workspace's own values override them by the same key, and no model ever types
 * one. `guidance` is words: how the agent works, put in front of the instructions of every model call of the agent. More kinds of
 * policy may be added beside these two.
 */
export interface ModuleAgentPolicy {
    /** The default numbers and switches the tools enforce, by camelCase key (money in VND, whole numbers). */
    readonly limits: Readonly<Record<string, number | string | boolean>>
    /** How the agent works, in the owner's two languages. */
    readonly guidance: { readonly vi: string; readonly en: string }
}

/**
 * The agent of a module: the set of tools it may ever use and the policy it works under. A step of a workflow of the module declares
 * its own tools inside this set (step inside agent inside installed), which the engine checks when a workflow is saved or adopted.
 */
export interface ModuleAgent {
    /** Every effect and tool id a step of this module's agent may declare. */
    readonly tools: ReadonlyArray<string>
    /** The policy the agent works under: the soft business policy the model reasons from. */
    readonly policy: ModuleAgentPolicy
    /** The default rights of a fresh agent on connected providers; absent for an agent that reaches no provider. */
    readonly abilities?: ModuleAgentAbilities | undefined
}

/** What `defineModule` takes: everything a module declares, as data. */
export interface ModuleDeclarationConfig {
    /** The agent of the module, when it has one: its tool set and its policy. */
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
     * The door tools the module's jobs and nodes call, by DOMAIN name `<group>.<action>` (`chat.send`, `ledger.append`); the door
     * resolves the workspace's provider, so a module never names one.
     */
    readonly tools?: ReadonlyArray<`${string}.${string}`>
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
