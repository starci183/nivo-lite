import { z } from "zod"

/** The HTTP methods of an API operation. */
export const OPEN_API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
/** How the API is authenticated. */
export const OPEN_API_AUTH_TYPES = ["none", "header", "query", "bearer", "basic"] as const
/** What a pulled endpoint's rows are about. */
export const OPEN_API_PULL_ENTITIES = ["customer", "order", "product", "transaction", "other"] as const

/** The steps of the wizard; an existing connection skips `agent`. */
export type OpenApiStep = "source" | "auth" | "pulls" | "tools" | "schedule" | "test" | "agent"
/** The steps of a new connection, in order. */
export const OPEN_API_STEPS: ReadonlyArray<OpenApiStep> = [
    "source",
    "auth",
    "pulls",
    "tools",
    "schedule",
    "test",
    "agent",
]
/** The steps when an existing connection is edited. */
export const OPEN_API_EDIT_STEPS: ReadonlyArray<OpenApiStep> = ["source", "auth", "pulls", "tools", "schedule", "test"]

/** The sync schedules the back end accepts. */
export const OPEN_API_SCHEDULES = [
    { id: "manual", minutes: null },
    { id: "15", minutes: 15 },
    { id: "60", minutes: 60 },
    { id: "360", minutes: 360 },
    { id: "1440", minutes: 1440 },
] as const

const paramSchema = z.object({
    name: z.string(),
    in: z.enum(["path", "query", "header"]),
    required: z.boolean().catch(false),
})

const opSchema = z.object({
    id: z.string().min(1),
    method: z.enum(OPEN_API_METHODS),
    path: z.string().startsWith("/"),
    summary: z.string().catch(""),
    params: z.array(paramSchema).catch([]),
    hasBody: z.boolean().catch(false),
    suggest: z
        .object({ itemsPath: z.string(), idField: z.string(), titleField: z.string() })
        .optional()
        .catch(undefined),
})

const pullSchema = z.object({
    opId: z.string(),
    entity: z.enum(OPEN_API_PULL_ENTITIES).catch("other"),
    itemsPath: z.string().catch(""),
    idField: z.string().catch(""),
    titleField: z.string().catch(""),
    fixedQuery: z.string().catch(""),
})

const configSchema = z.object({
    specUrl: z.string().catch(""),
    baseUrl: z.string().catch(""),
    authType: z.enum(OPEN_API_AUTH_TYPES).catch("none"),
    authName: z.string().catch(""),
    ops: z.array(z.unknown()).catch([]),
    pulls: z.array(z.unknown()).catch([]),
    tools: z.array(z.unknown()).catch([]),
})

/** One operation of a spec. */
export type OpenApiOp = z.infer<typeof opSchema>
/** One endpoint pulled on a schedule. */
export type OpenApiPullDef = z.infer<typeof pullSchema>
/** The stored configuration of a connection, cleaned. */
export interface OpenApiConfigView {
    readonly specUrl: string
    readonly baseUrl: string
    readonly authType: (typeof OPEN_API_AUTH_TYPES)[number]
    readonly authName: string
    readonly ops: ReadonlyArray<OpenApiOp>
    readonly pulls: ReadonlyArray<OpenApiPullDef>
    readonly tools: ReadonlyArray<string>
}

const keep = <T>(schema: z.ZodType<T>, raw: ReadonlyArray<unknown>): ReadonlyArray<T> =>
    raw.flatMap((item) => {
        const parsed = schema.safeParse(item)
        return parsed.success ? [parsed.data] : []
    })

/** Narrows the `ops` DataJson of the back end into operations; anything malformed is dropped. */
export const parseOpenApiOps = (raw: unknown): ReadonlyArray<OpenApiOp> => keep(opSchema, Array.isArray(raw) ? raw : [])

/** Narrows the `config` DataJson of the back end into a configuration; anything malformed is dropped. */
export const parseOpenApiConfig = (raw: unknown): OpenApiConfigView => {
    const parsed = configSchema.parse(raw ?? {})
    return {
        specUrl: parsed.specUrl,
        baseUrl: parsed.baseUrl,
        authType: parsed.authType,
        authName: parsed.authName,
        ops: parseOpenApiOps(parsed.ops),
        pulls: keep(pullSchema, parsed.pulls),
        tools: keep(z.string(), parsed.tools),
    }
}

/** The label of an operation: its method and path. */
export const openApiOpLabel = (op: Pick<OpenApiOp, "method" | "path">): string => `${op.method} ${op.path}`

/** A GET that can run on a schedule: no path parameter the sync cannot fill. */
export const isOpenApiPullable = (op: OpenApiOp): boolean =>
    op.method === "GET" && !op.params.some((p) => p.in === "path")

/** How the API is authenticated, one of {@link OPEN_API_AUTH_TYPES}. */
export type OpenApiAuthType = (typeof OPEN_API_AUTH_TYPES)[number]

/** The text fields of the address and sign-in step. */
export type OpenApiAuthField = "baseUrl" | "authName" | "authValue" | "authUser" | "authPassword"

/** The text fields of a pulled endpoint the owner can change. */
export type OpenApiPullField = "entity" | "itemsPath" | "idField" | "titleField" | "fixedQuery"

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
