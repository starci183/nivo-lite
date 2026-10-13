import { OPENAPI_METHODS } from "./openapi.contracts"
import type { OpenApiAuthHint, OpenApiOperation, OpenApiParam, OpenApiSpec, OpenApiSuggest } from "./openapi.contracts"
import { isApiJsonObject, suggestFields } from "./openapi-items.policy"
import type { ApiJsonObject } from "./openapi-items.policy"
import { OPENAPI_TEXT } from "./messages/openapi.messages"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"

const MAX_OPS = 500
const MAX_REF_DEPTH = 8

/** The parameters of an operation and whether it takes a body. */
interface OpenApiParamList {
    /** The parameters. */
    readonly params: ReadonlyArray<OpenApiParam>
    /** Whether it takes a body. */
    readonly hasBody: boolean
}

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const reject = (detail: string): DataSourcesError =>
    new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail } })

const resolveRef = (doc: ApiJsonObject, ref: string): unknown => {
    if (!ref.startsWith("#/")) return undefined
    let current: unknown = doc
    for (const part of ref.slice(2).split("/")) {
        if (!isApiJsonObject(current)) return undefined
        current = current[part.replace(/~1/gu, "/").replace(/~0/gu, "~")]
    }
    return current
}

const deref = (doc: ApiJsonObject, node: unknown, depth = 0): ApiJsonObject | undefined => {
    if (!isApiJsonObject(node)) return undefined
    if (typeof node.$ref === "string" && depth < MAX_REF_DEPTH) return deref(doc, resolveRef(doc, node.$ref), depth + 1)
    return node
}

const findArraySchema = (
    doc: ApiJsonObject,
    schema: unknown,
    path: string,
    depth: number,
): { path: string; item: ApiJsonObject } | undefined => {
    const resolved = deref(doc, schema)
    if (!resolved) return undefined
    if (resolved.type === "array" || resolved.items) {
        const item = deref(doc, resolved.items)
        return item ? { path, item } : undefined
    }
    if (depth >= 2 || !isApiJsonObject(resolved.properties)) return undefined
    for (const [key, value] of Object.entries(resolved.properties)) {
        const found = findArraySchema(doc, value, path ? `${path}.${key}` : key, depth + 1)
        if (found) return found
    }
    return undefined
}

const suggestFor = (doc: ApiJsonObject, operation: ApiJsonObject): OpenApiSuggest | undefined => {
    const responses = isApiJsonObject(operation.responses) ? operation.responses : {}
    const code = Object.keys(responses).find((c) => /^2\d\d$/u.test(c)) ?? (responses.default ? "default" : undefined)
    const response = code ? deref(doc, responses[code]) : undefined
    if (!response) return undefined
    let schema: unknown = response.schema
    if (!schema && isApiJsonObject(response.content)) {
        const json = response.content["application/json"]
        const media = isApiJsonObject(json) ? json : Object.values(response.content).find(isApiJsonObject)
        schema = isApiJsonObject(media) ? media.schema : undefined
    }
    const found = findArraySchema(doc, schema, "", 0)
    if (!found) return undefined
    const keys = isApiJsonObject(found.item.properties) ? Object.keys(found.item.properties) : []
    return { itemsPath: found.path, ...suggestFields(keys) }
}

const baseUrlOf = (doc: ApiJsonObject, specUrl: string): string => {
    let raw: string
    if (typeof doc.openapi === "string") {
        const server = Array.isArray(doc.servers) ? doc.servers.find(isApiJsonObject) : undefined
        raw = server ? text(server.url) : "/"
        const variables = server && isApiJsonObject(server.variables) ? server.variables : {}
        raw = raw.replace(/\{(\w+)\}/gu, (_match, name: string) => {
            const variable = variables[name]
            return isApiJsonObject(variable) ? text(variable.default) : ""
        })
    } else {
        const schemes = Array.isArray(doc.schemes) ? doc.schemes.map(String) : []
        const scheme = schemes.includes("https") || schemes.length === 0 ? "https" : (schemes[0] ?? "https")
        const basePath = text(doc.basePath)
        raw = doc.host ? `${scheme}://${text(doc.host)}${basePath}` : basePath || "/"
    }
    const base = specUrl === "" ? undefined : specUrl
    if (URL.canParse(raw, base)) return new URL(raw, base).toString().replace(/\/+$/u, "")
    return raw.startsWith("http") ? raw.replace(/\/+$/u, "") : ""
}

const schemesOf = (doc: ApiJsonObject): ApiJsonObject => {
    const components = isApiJsonObject(doc.components) ? doc.components : {}
    if (isApiJsonObject(components.securitySchemes)) return components.securitySchemes
    return isApiJsonObject(doc.securityDefinitions) ? doc.securityDefinitions : {}
}

const authHintOf = (doc: ApiJsonObject): OpenApiAuthHint => {
    const schemes = schemesOf(doc)
    for (const raw of Object.values(schemes)) {
        const scheme = deref(doc, raw)
        if (!scheme) continue
        const type = text(scheme.type).toLowerCase()
        if (type === "apikey")
            return { type: text(scheme.in) === "query" ? "query" : "header", name: text(scheme.name) }
        if (type === "basic" || (type === "http" && text(scheme.scheme).toLowerCase() === "basic")) {
            return { type: "basic", name: "" }
        }
        if (type === "http" || type === "oauth2" || type === "openidconnect") return { type: "bearer", name: "" }
    }
    return { type: "none", name: "" }
}

const cleanId = (value: string): string =>
    value
        .replace(/[^A-Za-z0-9_]+/gu, "_")
        .replace(/^_+|_+$/gu, "")
        .slice(0, 80)

const paramsOf = (
    doc: ApiJsonObject,
    shared: ReadonlyArray<unknown>,
    own: ReadonlyArray<unknown>,
    hasRequestBody: boolean,
): OpenApiParamList => {
    const byKey = new Map<string, OpenApiParam>()
    let hasBody = hasRequestBody
    for (const raw of [...shared, ...own]) {
        const param = deref(doc, raw)
        if (!param) continue
        const where = text(param.in)
        if (where === "body") {
            hasBody = true
            continue
        }
        if ((where !== "path" && where !== "query" && where !== "header") || !text(param.name)) continue
        byKey.set(`${where}:${text(param.name)}`, {
            name: text(param.name),
            in: where,
            required: where === "path" || param.required === true,
        })
    }
    return { params: [...byKey.values()], hasBody }
}

/** Describes an already parsed OpenAPI 3.x / Swagger 2.0 document; throws a plain Vietnamese refusal when it is not one. */
export const describeSpec = (doc: unknown, specUrl: string): OpenApiSpec => {
    const isV3 = isApiJsonObject(doc) && typeof doc.openapi === "string" && doc.openapi.startsWith("3")
    const isV2 = isApiJsonObject(doc) && doc.swagger === "2.0"
    if (!isApiJsonObject(doc) || !(isV3 || isV2)) throw reject(OPENAPI_TEXT.notSpec)
    const paths = isApiJsonObject(doc.paths) ? doc.paths : {}
    const ops: Array<OpenApiOperation> = []
    const used = new Set<string>()
    for (const [path, rawItem] of Object.entries(paths)) {
        const item = deref(doc, rawItem)
        if (!item || !path.startsWith("/")) continue
        const shared = Array.isArray(item.parameters) ? item.parameters : []
        for (const method of OPENAPI_METHODS) {
            const operation = deref(doc, item[method.toLowerCase()])
            if (!operation || ops.length >= MAX_OPS) continue
            const own = Array.isArray(operation.parameters) ? operation.parameters : []
            const { params, hasBody } = paramsOf(doc, shared, own, isApiJsonObject(operation.requestBody))
            let id = cleanId(text(operation.operationId)) || cleanId(`${method.toLowerCase()}_${path}`)
            for (let n = 2; used.has(id); n++) id = `${id.replace(/_\d+$/u, "")}_${n}`
            used.add(id)
            const summary = text(operation.summary) || text(operation.description)
            const suggest = method === "GET" ? suggestFor(doc, operation) : undefined
            ops.push({
                id,
                method,
                path,
                summary: summary.replace(/\s+/gu, " ").slice(0, 120),
                params,
                hasBody,
                ...(suggest ? { suggest } : {}),
            })
        }
    }
    if (ops.length === 0) throw reject(OPENAPI_TEXT.noOperations)
    const info = isApiJsonObject(doc.info) ? doc.info : {}
    return { title: text(info.title).slice(0, 80), baseUrl: baseUrlOf(doc, specUrl), ops, authHint: authHintOf(doc) }
}
