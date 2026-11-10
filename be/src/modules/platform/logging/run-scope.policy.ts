import { AsyncLocalStorage } from "node:async_hooks"

/** The agent run the current work belongs to, or null when it is not inside one. */
type OptionalRunScope = string | null

/** The work a run scope holds: whatever it awaits is in the scope. */
type RunScopeWork<T> = () => Promise<T>

const scope = new AsyncLocalStorage<string>()

/** Runs `work` with `runId` as the agent run in scope: everything it awaits, a model call among it, can be booked to that run. */
export const withRunScope = <T>(runId: string, work: RunScopeWork<T>): Promise<T> => scope.run(runId, work)

/** The agent run the current work belongs to, or null when it is not inside one. */
export const runInScope = (): OptionalRunScope => scope.getStore() ?? null
