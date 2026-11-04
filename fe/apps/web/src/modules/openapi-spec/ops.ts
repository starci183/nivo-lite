import { OPEN_API_AUTH_TYPES, OPEN_API_PULL_ENTITIES, OPEN_API_SCHEDULES } from "./spec"
import type { OpenApiAuthType, OpenApiConfigView, OpenApiOp, OpenApiPullDef } from "./spec"

/** The most operations one list shows; a search narrows the rest. */
export const OPEN_API_SHOWN = 200

/** True when the method, path or summary of the operation holds the search text; an empty search matches every operation. */
export const matchesOpenApiOp = (op: OpenApiOp, query: string): boolean =>
    query === "" || `${op.method} ${op.path} ${op.summary}`.toLowerCase().includes(query.toLowerCase())

/** A new pull of an operation, its response mapping taken from the guess of the spec. */
export const newOpenApiPull = (op: OpenApiOp): OpenApiPullDef => ({
    opId: op.id,
    entity: "other",
    itemsPath: op.suggest?.itemsPath ?? "",
    idField: op.suggest?.idField ?? "",
    titleField: op.suggest?.titleField ?? "",
    fixedQuery: "",
})

/** The required query parameters of an operation, comma separated; empty when it has none. */
export const requiredQueryOf = (op: OpenApiOp): string =>
    op.params
        .filter((param) => param.in === "query" && param.required)
        .map((param) => param.name)
        .join(", ")

/** The auth type a select answered, or undefined when it is not one. */
export const openApiAuthTypeOf = (value: string | null): OpenApiAuthType | undefined =>
    OPEN_API_AUTH_TYPES.find((type) => type === value)

/** The pulled entity a select answered, or undefined when it is not one. */
export const openApiEntityOf = (value: string | null): OpenApiPullDef["entity"] | undefined =>
    OPEN_API_PULL_ENTITIES.find((entity) => entity === value)

/** The schedule id of a stored sync interval; anything unknown is manual. */
export const openApiScheduleIdOf = (minutes: number | null): string =>
    OPEN_API_SCHEDULES.find((schedule) => schedule.minutes === minutes)?.id ?? "manual"

/** The sync interval of a schedule id; manual and unknown ids are null. */
export const openApiScheduleMinutesOf = (id: string): number | null =>
    OPEN_API_SCHEDULES.find((schedule) => schedule.id === id)?.minutes ?? null

/** The fresh operations of a spec, plus the stored ones that are pulled or offered as tools but no longer in the spec. */
export const mergeOpenApiOps = (
    fresh: ReadonlyArray<OpenApiOp>,
    config: OpenApiConfigView,
): ReadonlyArray<OpenApiOp> => {
    const keep = new Set([...config.pulls.map((pull) => pull.opId), ...config.tools])
    return [...fresh, ...config.ops.filter((op) => keep.has(op.id) && !fresh.some((item) => item.id === op.id))]
}
