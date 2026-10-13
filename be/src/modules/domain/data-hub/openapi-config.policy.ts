import { OPENAPI_AUTH_TYPES, OPENAPI_METHODS, OPENAPI_PULL_ENTITIES, isApiJsonObject, readApiJson } from "@modules/integrations/data-sources"
import type { OpenApiAuthDraft } from "./openapi-wizard.contracts"
import { apiSummary } from "./messages/openapi.messages"
import type {
    OpenApiAuth,
    OpenApiAuthType,
    OpenApiConfig,
    OpenApiMethod,
    OpenApiOperation,
    OpenApiParam,
    OpenApiPull,
    OpenApiPullEntity,
} from "@modules/integrations/data-sources"

const clip = (value: unknown, max = 500): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const isMethod = (value: string): value is OpenApiMethod => OPENAPI_METHODS.some((method) => method === value)
const isAuthType = (value: string): value is OpenApiAuthType => OPENAPI_AUTH_TYPES.some((type) => type === value)
const isEntity = (value: string): value is OpenApiPullEntity => OPENAPI_PULL_ENTITIES.some((entity) => entity === value)

const cleanParams = (raw: unknown): ReadonlyArray<OpenApiParam> =>
    (Array.isArray(raw) ? raw : []).filter(isApiJsonObject).flatMap((param): Array<OpenApiParam> => {
        const where = clip(param.in)
        const name = clip(param.name, 100)
        return (where === "path" || where === "query" || where === "header") && name
            ? [{ name, in: where, required: param.required === true }]
            : []
    })

const cleanOps = (raw: unknown): ReadonlyArray<OpenApiOperation> =>
    (Array.isArray(raw) ? raw : []).filter(isApiJsonObject).flatMap((op): Array<OpenApiOperation> => {
        const method = clip(op.method).toUpperCase()
        const path = clip(op.path)
        const id = clip(op.id, 80)
        if (!isMethod(method) || !path.startsWith("/") || !id) return []
        return [{ id, method, path, summary: clip(op.summary, 120), params: cleanParams(op.params), hasBody: op.hasBody === true }]
    })

const cleanPulls = (raw: unknown, ops: ReadonlyArray<OpenApiOperation>): ReadonlyArray<OpenApiPull> =>
    (Array.isArray(raw) ? raw : []).filter(isApiJsonObject).flatMap((pull): Array<OpenApiPull> => {
        const op = ops.find((candidate) => candidate.id === clip(pull.opId))
        if (!op || op.method !== "GET") return []
        const entity = clip(pull.entity)
        return [
            {
                opId: op.id,
                entity: isEntity(entity) ? entity : "other",
                itemsPath: clip(pull.itemsPath, 200),
                idField: clip(pull.idField, 200),
                titleField: clip(pull.titleField, 200),
                fixedQuery: clip(pull.fixedQuery).replace(/^\?/u, ""),
            },
        ]
    })

/** Cleans a config that came from the browser or storage: unknown values are dropped, never trusted. */
export const normalizeConfig = (raw: unknown): OpenApiConfig => {
    const source = isApiJsonObject(raw) ? raw : {}
    const ops = cleanOps(source.ops)
    const known = new Set(ops.map((op) => op.id))
    const tools = (Array.isArray(source.tools) ? source.tools : []).map((tool) => clip(tool, 80)).filter((tool) => known.has(tool))
    const authType = clip(source.authType)
    return {
        v: 1,
        specUrl: clip(source.specUrl, 1000),
        baseUrl: clip(source.baseUrl, 1000).replace(/\/+$/u, ""),
        authType: isAuthType(authType) ? authType : "none",
        authName: clip(source.authName, 100),
        ops,
        pulls: cleanPulls(source.pulls, ops),
        tools: [...new Set(tools)],
    }
}

/** The config JSON of a connection's public facts, checked (null when missing or broken). */
export const parseConfig = (raw: string | undefined | null): OpenApiConfig | null => {
    if (!raw) return null
    const read = readApiJson(raw)
    return isApiJsonObject(read.value) ? normalizeConfig(read.value) : null
}

/** The short line shown on the connection card. */
export const summaryOf = (config: OpenApiConfig): string => apiSummary(config.pulls.length, config.tools.length)

/** Reads the stored credential JSON into a checked credential (empty when broken). */
export const parseAuth = (raw: string): OpenApiAuth => {
    const read = readApiJson(raw)
    const source = isApiJsonObject(read.value) ? read.value : {}
    const type = clip(source.type)
    return {
        type: isAuthType(type) ? type : "none",
        name: clip(source.name, 100),
        value: typeof source.value === "string" ? source.value : "",
        user: typeof source.user === "string" ? source.user : "",
        password: typeof source.password === "string" ? source.password : "",
    }
}

/** The typed auth with blank secrets filled from the stored one when the type is unchanged (edit mode). */
export const mergeAuth = (typed: OpenApiAuth, stored: OpenApiAuth | null): OpenApiAuth => {
    if (stored === null || stored.type !== typed.type) return typed
    return {
        ...typed,
        value: typed.value || stored.value,
        user: typed.user || stored.user,
        password: typed.password || stored.password,
    }
}

/** The credential JSON exactly as the old code stored it. */
export const credentialOf = (config: OpenApiConfig, auth: OpenApiAuth): string =>
    JSON.stringify({ type: config.authType, name: config.authName, value: auth.value, user: auth.user, password: auth.password })

/** Cleans the credential typed in the wizard: an unknown type is none, names are trimmed. */
export const cleanAuth = (draft: OpenApiAuthDraft): OpenApiAuth =>
    parseAuth(JSON.stringify(draft))
