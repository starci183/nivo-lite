import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"

/**
 * The switches that make `@langchain/core` send every run (prompts, model answers, tool arguments) to LangSmith. `langsmith` comes
 * in with `@langchain/core`, and one of these set to `true` is all it takes.
 */
export const TRACING_SWITCHES: ReadonlyArray<string> = [
    "LANGSMITH_TRACING",
    "LANGSMITH_TRACING_V2",
    "LANGCHAIN_TRACING",
    "LANGCHAIN_TRACING_V2",
]

/**
 * Refuses an environment in which a tracing switch is set at all, whatever its value: the app then never starts with a way for
 * customer data to reach an outside tracing service, and nobody has to know which spellings of "off" the library honours.
 *
 * @param isSet - Whether the environment declares a key (the reader's `has`).
 * @throws {LanggraphError} `LANGGRAPH_TRACING_FORBIDDEN` naming the first switch that is set.
 */
export const requireNoTracing = (isSet: (key: string) => boolean): void => {
    const key = TRACING_SWITCHES.find((name) => isSet(name))
    if (key !== undefined) throw new LanggraphError({ code: LanggraphErrorCode.TracingForbidden, params: { key } })
}
