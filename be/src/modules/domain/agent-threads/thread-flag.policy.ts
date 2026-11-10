/**
 * The workflows cleared to run on threads, each proved there by the twin-walk, stop and kill specs of `tests/engine-threads/`. Phase 0:
 * the front desk. Phase 1: the sales consult and the reconcile (both of its triggers). Phase 2: the four sales care workflows, the web
 * order and the reports. A name outside the list is refused at boot, so a typo or an early switch never moves a workflow the engine
 * cannot carry. Being listed only clears a name: a workflow runs on threads when the flag names it, or when the default engine is
 * LangGraph (`DEFAULT_ENGINE`, `AGENT_ENGINE_DEFAULT`).
 */
export const THREAD_READY_WORKFLOWS: ReadonlyArray<string> = [
    "chatbot.front-desk",
    "sales.consult",
    "accounting.reconcile",
    "sales.after-sale",
    "sales.delivery-check",
    "sales.occasion",
    "sales.payment-reminder",
    "sales.web-order",
    "accounting.reports",
    // The team chat turn (C1): a person of the shop talks to an agent in /chat. Threads only: no old-engine path exists for it.
    "sales.team-chat",
    "accounting.team-chat",
    "chatbot.team-chat",
]

/** The engine a run starts on: the old step engine, or a LangGraph thread. A run finishes on the engine it started on. */
export type ThreadEngine = "legacy" | "langgraph"

/** The engines, in the words the env takes. */
const ENGINES: ReadonlyArray<ThreadEngine> = ["legacy", "langgraph"]

/**
 * The engine a NEW run of a cleared workflow starts on when the env says nothing (`AGENT_ENGINE_DEFAULT` unset). The old engine until
 * the nine-workflow walk passes on threads; switching it is this one word. A run already started never moves.
 */
export const DEFAULT_ENGINE: ThreadEngine = "legacy"

/** What the default engine's text says: an engine, or the word that is none. */
export type EngineDefaultRead =
    | {
          /** A known engine. */
          readonly kind: "engine"
          /** That engine. */
          readonly engine: ThreadEngine
      }
    | {
          /** The text names no engine. */
          readonly kind: "invalid"
          /** That text. */
          readonly name: string
      }

/** The env's text of the default engine, or undefined when it is not set. */
export type EngineDefaultText = string | undefined

/** Reads the default engine's text: none (or blanks) takes `DEFAULT_ENGINE`; anything but `legacy` or `langgraph` is refused by name. */
export const engineDefaultOf = (text: EngineDefaultText): EngineDefaultRead => {
    const word = (text ?? "").trim()
    if (word === "") return { kind: "engine", engine: DEFAULT_ENGINE }
    const engine = ENGINES.find((candidate) => candidate === word)
    return engine === undefined ? { kind: "invalid", name: word } : { kind: "engine", engine }
}

/**
 * The workflows whose NEW runs start on a thread: those the flag names, and with the default engine LangGraph every cleared workflow
 * as well (the flag's order first, once each). With the old engine as default it is exactly the flag's list, so an unset flag stays off.
 */
export const threadWorkflowsOf = (named: ReadonlyArray<string>, engine: ThreadEngine): ReadonlyArray<string> =>
    engine === "langgraph" ? [...new Set([...named, ...THREAD_READY_WORKFLOWS])] : named

/** A workflow as the flag names it: `<moduleKey>.<workflowKey>`. */
const WORKFLOW_NAME = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/** What the flag's text names: the workflows, or the first name that may not be there. */
export type ThreadFlagRead =
    | {
          /** Every name is a workflow cleared for threads. */
          readonly kind: "workflows"
          /** The workflows, once each, in the order written. */
          readonly workflows: ReadonlyArray<string>
      }
    | {
          /** A name is no workflow name, or is not cleared for threads yet. */
          readonly kind: "invalid"
          /** That name. */
          readonly name: string
      }

/**
 * Reads the flag's text, a comma-separated list of `<moduleKey>.<workflowKey>`. No text, or only blanks and commas, names no
 * workflow: the flag is off and the old engine runs everything.
 */
export const threadFlagOf = (text: string | undefined): ThreadFlagRead => {
    const names = (text ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "")
    const invalid = names.find((name) => !WORKFLOW_NAME.test(name) || !THREAD_READY_WORKFLOWS.includes(name))
    return invalid === undefined ? { kind: "workflows", workflows: [...new Set(names)] } : { kind: "invalid", name: invalid }
}
