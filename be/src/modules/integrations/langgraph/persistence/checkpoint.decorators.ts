import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { CheckpointLimits } from "./checkpoint-size.policy"
import type { CheckpointStore } from "./checkpoint-store.port"

/** Token of the rows the checkpoint saver reads and writes; the domain capability that owns the checkpoint tables provides it. */
export const CHECKPOINT_STORE: unique symbol = Symbol("integrations.langgraph.checkpoint-store")

/** Token of the saver's limits; when nothing provides it the defaults hold. */
export const CHECKPOINT_LIMITS: unique symbol = Symbol("integrations.langgraph.checkpoint-limits")

/** Injects the rows of every thread. Parameter type: CheckpointStore. */
export const InjectCheckpointStore = (): TypedParameterDecorator<CheckpointStore> =>
    injector<CheckpointStore>(CHECKPOINT_STORE)

/** Injects the saver's limits. Parameter type: CheckpointLimits. */
export const InjectCheckpointLimits = (): TypedParameterDecorator<CheckpointLimits> =>
    injector<CheckpointLimits>(CHECKPOINT_LIMITS)
