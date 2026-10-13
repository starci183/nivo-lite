import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OptionalWorkPerformer, WorkPerformer } from "./decisions.contracts"

/** Where capabilities register the performer of each action, and where the engine looks one up. */
export interface WorkPerformerRegistry {
    /** Registers the performer of an action; a second registration of the same action replaces the first. */
    add(action: string, performer: WorkPerformer): void
    /** The performer registered for an action, or null when the action only records the decision. */
    performerOf(action: string): OptionalWorkPerformer
}

/** Token of the performer registry. */
export const WORK_PERFORMER_REGISTRY: unique symbol = Symbol("domain.decisions.work-performer-registry")

/** Injects the performer registry. Parameter type: WorkPerformerRegistry. */
export const InjectWorkPerformerRegistry = (): TypedParameterDecorator<WorkPerformerRegistry> =>
    injector<WorkPerformerRegistry>(WORK_PERFORMER_REGISTRY)
