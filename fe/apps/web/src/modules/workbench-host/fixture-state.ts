import type { ActionInput, ActionOutcome, ReadVariables } from "@nivo-lite/agent-sdk/block"
import type { HostRead } from "@nivo-lite/agent-sdk/client"
import { isRecord } from "./json-shape"

/** The key of the URL query that picks the state a prototype read shows; only the fixture port reads it. */
export const FIXTURE_QUERY_KEY = "fixture"

/** The states of a read a prototype screen can be forced into. */
export type FixtureMode = "ready" | "loading" | "empty" | "error" | "forbidden"

/** What the fixture data of one read is: its answer for the given variables. */
export type FixtureReadSource = (variables: ReadVariables) => unknown

/** What the fixture outcome of one action is: how it ends for the given input. */
export type FixtureActionSource = (input: ActionInput) => ActionOutcome

/** The fixtures a prototype is drawn from, by operation name (the read id or the action id). */
export interface FixtureTables {
    readonly reads: Readonly<Record<string, FixtureReadSource>>
    readonly actions: Readonly<Record<string, FixtureActionSource>>
}

/** The fixtures of an app that declares none. */
export const NO_FIXTURES: FixtureTables = { reads: {}, actions: {} }

const MODES: ReadonlyArray<FixtureMode> = ["ready", "loading", "empty", "error", "forbidden"]

/** The state the `fixture` query value picks; ready for an absent or unknown value. */
export const fixtureModeOf = (value: string | null): FixtureMode => MODES.find((mode) => mode === value) ?? "ready"

/** The same data with nothing in it: an empty list, a page with no rows and no cursor, or null for a record. */
export const emptyOf = (data: unknown): unknown => {
    if (Array.isArray(data)) return []
    if (isRecord(data) && Array.isArray(data.rows)) return { ...data, rows: [], cursor: null }
    return null
}

const idle = (): void => undefined

/** The read state for a fixture mode over the fixture data; the data of a loading, failed or refused read is null. */
export const fixtureReadOf = (mode: FixtureMode, data: unknown, reload: () => void = idle): HostRead => {
    const settled = { isValidating: false, reload, page: null }
    if (mode === "ready") return { status: "ready", data, ...settled }
    if (mode === "empty") return { status: "ready", data: emptyOf(data), ...settled }
    return { status: mode, data: null, ...settled }
}

/** The outcome of an action nobody wrote a fixture for. */
export const SUCCEEDED: ActionOutcome = { ok: true }
