import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"

/** The constraint name a refused state change answers under (`invalid`): `<state field>_transition`. */
export const transitionConstraintOf = (field: string): string => `${field}_transition`

/** The value a write gives the state field, when it names one. */
const named = (values: Readonly<Record<string, unknown>>, field: string): string | null => {
    const value = Object.hasOwn(values, field) ? values[field] : undefined
    return typeof value === "string" ? value : null
}

/**
 * The refusal of an insert whose state is not one the type declares a record may start in (`StatesDef.initial`), or null. A type with
 * no declared states, or no `initial`, takes any value of the field (its enum CHECK still holds).
 */
export const insertStateRefusal = (entity: EntityDefinition, values: Readonly<Record<string, unknown>>): string | null => {
    const { states } = entity
    if (states?.initial === undefined) return null
    const state = named(values, states.field)
    return state === null || states.initial.includes(state) ? null : transitionConstraintOf(states.field)
}

/** The states a state may move to: its declared entry, none for a final state. */
const nextOf = (transitions: Readonly<Record<string, ReadonlyArray<string>>>, from: string): ReadonlyArray<string> =>
    (Object.hasOwn(transitions, from) ? transitions[from] : undefined) ?? []

/**
 * The refusal of an update that moves the state along no declared transition, or null: staying is always allowed; a state with no
 * entry is final. Exact comparison of the declared values, never a meaning.
 */
export const updateStateRefusal = (
    entity: EntityDefinition,
    current: RecordRow,
    patch: Readonly<Record<string, unknown>>,
): string | null => {
    const { states } = entity
    if (states === undefined) return null
    const next = named(patch, states.field)
    const from = named(current.data, states.field)
    if (next === null || next === from) return null
    const allowed = from === null ? [] : nextOf(states.transitions, from)
    return allowed.includes(next) ? null : transitionConstraintOf(states.field)
}

/** Whether a write names the state field of a type that declares states (so the current value must be read first). */
export const movesState = (entity: EntityDefinition, values: Readonly<Record<string, unknown>>): boolean =>
    entity.states !== undefined && Object.hasOwn(values, entity.states.field)
