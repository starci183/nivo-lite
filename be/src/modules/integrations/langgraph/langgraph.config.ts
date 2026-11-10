import type { EnvSource } from "@modules/platform/config"
import type { LanggraphOptions } from "./langgraph.options"
import { requireNoTracing } from "./tracing-guard.policy"

/** How many compiled graphs are kept unless the app says otherwise: a graph is five or six nodes, a version is compiled once. */
const DEFAULT_COMPILED_MAX = 200

/** How many nodes one call may run unless the app says otherwise; a workflow is a handful of steps, a loop a few dozen rounds. */
const DEFAULT_STEP_LIMIT = 500

/**
 * Reads the LangGraph integration options (`LANGGRAPH_COMPILED_MAX` and `LANGGRAPH_STEP_LIMIT`, tunables) and guards the boot: when
 * a tracing switch of LangSmith is set the parse throws `LANGGRAPH_TRACING_FORBIDDEN` naming the key (`requireNoTracing`), so the
 * app does not start. The engine also never passes a tracer or a callback of its own.
 */
export const parseLanggraphConfig = (env: EnvSource): LanggraphOptions => {
    requireNoTracing((key) => env.has(key))
    return {
        compiledMax: env.int("LANGGRAPH_COMPILED_MAX", DEFAULT_COMPILED_MAX),
        stepLimit: env.int("LANGGRAPH_STEP_LIMIT", DEFAULT_STEP_LIMIT),
    }
}
