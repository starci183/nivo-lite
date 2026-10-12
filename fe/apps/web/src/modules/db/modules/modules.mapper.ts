import type { Json } from "../../../../../../../supabase/types/database.types"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import type { Installation, InstallationStatus, OperatingMode } from "@/modules/installations"

/** The columns of an installation with its agent and the number of its active context version. */
export const INSTALLATION_COLUMNS =
    "*, agent:agents(name, handle), active:module_context_versions!module_installations_active_version_fk(version)"

/** One installation row as the readers select it. */
export type InstallationRow = {
    readonly id: string
    readonly workspace_id: string
    readonly module_key: string
    readonly name: string
    readonly is_multi: boolean
    readonly agent_id: string | null
    readonly status: string
    readonly operating_mode: string
    readonly live_enabled: boolean
    readonly active_context_version_id: string | null
    readonly settings: Json
    readonly created_at: string
    readonly agent: { readonly name: string; readonly handle: string } | null
    readonly active: { readonly version: number } | null
}

const STATUSES: ReadonlyArray<InstallationStatus> = ["installing", "setup", "ready", "live", "paused"]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const NAME_MAX = 80
const AGENT_NAME_MIN = 2
const AGENT_NAME_MAX = 40

/** Whether a value is a plain object. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The installation status of a stored text; an unknown text is a setup in progress. */
export const toInstallationStatus = (value: string): InstallationStatus =>
    STATUSES.find((status) => status === value) ?? "setup"

/** The operating mode of a stored text; an unknown text is the cautious assist mode. */
export const toOperatingMode = (value: string): OperatingMode => (value === "autopilot" ? "autopilot" : "assist")

/** The installation a row stands for; null when its module is not in the catalogue. */
export const toInstallation = (row: InstallationRow): Installation | null => {
    if (!isModuleKey(row.module_key)) return null
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        moduleKey: row.module_key,
        name: row.name.trim() || MODULE_REGISTRY[row.module_key].name.vi,
        isMulti: row.is_multi,
        agentId: row.agent_id,
        agentName: row.agent?.name ?? "",
        agentHandle: row.agent?.handle ?? row.module_key,
        status: toInstallationStatus(row.status),
        operatingMode: toOperatingMode(row.operating_mode),
        liveEnabled: row.live_enabled,
        activeContextVersionId: row.active_context_version_id,
        activeVersion: row.active?.version ?? null,
        settings: isRecord(row.settings) ? row.settings : {},
        createdAt: row.created_at,
    }
}

/** The authority rows installing a module grants to a workspace: the defaults of its actions, never overwriting a choice already made. */
export const defaultRuleRows = (workspaceId: string, moduleKey: ModuleKey) =>
    MODULE_REGISTRY[moduleKey].authorityActions.map((action) => ({
        workspace_id: workspaceId,
        department: moduleKey,
        action: action.action,
        mode: action.mode,
        limit_vnd: action.limitVnd,
        required_fields: [...action.requiredFields],
    }))

/** A parsed result: the data, or a failure without detail. */
export type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

/** The fields of an input that is an object, else null. */
export const objectOf = (input: unknown): Readonly<Record<string, unknown>> | null => (isRecord(input) ? input : null)
/** The text when it is a UUID, else null. */
export const uuidOf = (value: unknown): string | null => (typeof value === "string" && UUID.test(value) ? value : null)

/** What installing an agent takes: the workspace, the module, the language of the first welcome and an optional instance name. */
export type InstallInput = {
    readonly workspaceId: string
    readonly moduleKey: ModuleKey
    readonly locale: "vi" | "en"
    readonly newInstance: boolean
    readonly name: string | null
}

/** The bounded schema of an install request. */
export const installSchema = {
    safeParse: (input: unknown): Parsed<InstallInput> => {
        const fields = objectOf(input)
        if (fields === null) return { success: false }
        const workspaceId = uuidOf(fields.workspaceId)
        const moduleKey = fields.moduleKey
        const name = fields.name
        if (workspaceId === null || typeof moduleKey !== "string" || !isModuleKey(moduleKey)) return { success: false }
        if (name !== undefined && (typeof name !== "string" || name.length > NAME_MAX * 2)) return { success: false }
        return {
            success: true,
            data: {
                workspaceId,
                moduleKey,
                locale: fields.locale === "en" ? "en" : "vi",
                newInstance: fields.newInstance === true,
                name: typeof name === "string" ? name : null,
            },
        }
    },
}

/** A reader of one value out of the fields of an input: the value, or undefined when the fields do not hold an acceptable one. */
export type FieldReader<V> = (fields: Readonly<Record<string, unknown>>) => V | undefined

/** The schema of an input that names one row by the id field and carries one more value read from its fields. */
export const rowValueSchema = <V>(idField: string, read: FieldReader<V>) => ({
    safeParse: (input: unknown): Parsed<{ readonly id: string; readonly value: V }> => {
        const fields = objectOf(input)
        const id = uuidOf(fields?.[idField])
        const value = fields === null ? undefined : read(fields)
        return id === null || value === undefined ? { success: false } : { success: true, data: { id, value } }
    },
})

/** The bounded schema of a rename request: the installation and the new name. */
export const nameSchema = rowValueSchema("installationId", (fields) =>
    typeof fields.name === "string" && fields.name.length <= NAME_MAX * 2 ? fields.name : undefined,
)

/** The limits of an agent display name. */
export const AGENT_NAME_LIMITS = { min: AGENT_NAME_MIN, max: AGENT_NAME_MAX } as const

/** The bounded schema of the operating mode request. */
export const modeSchema = rowValueSchema("installationId", (fields): OperatingMode | undefined =>
    fields.mode === "assist" || fields.mode === "autopilot" ? fields.mode : undefined,
)

/** The bounded schema of the live switch request. */
export const liveSchema = rowValueSchema("installationId", (fields) =>
    typeof fields.on === "boolean" ? fields.on : undefined,
)

/** A JSON object: the shape of a stored payload. */
export type JsonObject = { [key: string]: Json | undefined }

/** Whether a value is plain JSON data. */
export const isJson = (value: unknown): value is Json => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return true
    if (Array.isArray(value)) return value.every(isJson)
    return isRecord(value) && Object.values(value).every((item) => item === undefined || isJson(item))
}

/** The value as a JSON object, or null when it is anything else. */
export const toJsonObject = (value: unknown): JsonObject | null => {
    if (!isRecord(value) || !isJson(value) || value === null || Array.isArray(value)) return null
    return Object.fromEntries(Object.entries(value))
}

/** One setting of an installation a change writes: the name and the value (null removes it). */
export type SettingChange = {
    readonly name: "openclawTimeoutSec" | "holdingMessage"
    readonly value: number | string | null
}

const REPLY_TIMEOUT_MIN = 5
const REPLY_TIMEOUT_MAX = 120
const HOLDING_MAX = 400

/** The bounded schema of a settings change: the reply timeout in seconds, or the holding message. */
export const settingsSchema = rowValueSchema("installationId", (fields): SettingChange | undefined => {
    if (fields.name === "openclawTimeoutSec") {
        const seconds = Math.round(Number(fields.value))
        return seconds >= REPLY_TIMEOUT_MIN && seconds <= REPLY_TIMEOUT_MAX
            ? { name: fields.name, value: seconds }
            : undefined
    }
    if (fields.name !== "holdingMessage" || typeof fields.value !== "string") return undefined
    const text = fields.value.trim().slice(0, HOLDING_MAX)
    return { name: fields.name, value: text === "" ? null : text }
})
