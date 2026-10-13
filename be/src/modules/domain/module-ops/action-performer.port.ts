import type { PerformContext, PerformResult } from "./module-ops.contracts"

/** What a module registers to run an action once the gate lets it through. */
export interface ActionPerformer {
    /** The gated action id this performer runs. */
    readonly action: string
    /** Runs the allowed action and reports what happened. */
    perform(context: PerformContext): Promise<PerformResult>
    /** Undoes the preparation when the owner refuses; omitted when a refusal needs no cleanup. */
    reject?(context: PerformContext): Promise<void>
}

/** Where the modules register their performers and the gate looks them up. It is also the injection token. */
export abstract class ActionPerformerRegistry {
    /** Registers a performer; a second performer of the same action replaces the first. */
    abstract add(performer: ActionPerformer): void
    /** The performers registered for an action: one, or none when no module registered one. */
    abstract performersOf(action: string): ReadonlyArray<ActionPerformer>
}
