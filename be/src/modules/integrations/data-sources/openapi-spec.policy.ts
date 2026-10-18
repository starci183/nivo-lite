import { OPENAPI_METHODS } from "./openapi.contracts"
import type { OpenApiAuthHint, OpenApiOperation, OpenApiParam, OpenApiSpec, OpenApiSuggest } from "./openapi.contracts"
import { isApiJsonObject, suggestFields } from "./openapi-items.policy"
import type { ApiJsonObject } from "./openapi-items.policy"
import { OPENAPI_TEXT } from "./messages/openapi.messages"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { trimUrlSlashes } from "./openapi-text.policy"

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
        current = current[part.replaceAll("~1", "/").replaceAll("~0", "~")]
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

const v3ServerUrl = (doc: ApiJsonObject): string => {
    const server = Array.isArray(doc.servers) ? doc.servers.find(isApiJsonObject) : undefined
    const raw = server ? text(server.url) : "/"
    const variables = server && isApiJsonObject(server.variables) ? server.variables : {}
    return raw.replace(/\{(\w+)\}/gu, (_match, name: string) => {
        const variable = variables[name]
        return isApiJsonObject(variable) ? text(variable.default) : ""
    })
}

const v2ServerUrl = (doc: ApiJsonObject): string => {
    const schemes = Array.isArray(doc.schemes) ? doc.schemes.map(String) : []
    const scheme = schemes.includes("https") || schemes.length === 0 ? "https" : (schemes[0] ?? "https")
    const basePath = text(doc.basePath)
    return doc.host ? `${scheme}://${text(doc.host)}${basePath}` : basePath || "/"
}

const baseUrlOf = (doc: ApiJsonObject, specUrl: string): string => {
    const raw = typeof doc.openapi === "string" ? v3ServerUrl(doc) : v2ServerUrl(doc)
    const base = specUrl === "" ? undefined : specUrl
    if (URL.canParse(raw, base)) return trimUrlSlashes(new URL(raw, base).toString())
    return raw.startsWith("http") ? trimUrlSlashes(raw) : ""
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

const cleanId = (value: string): string => {
    const normalized = value.replace(/\W+/gu, "_")
    let start = 0
    let end = normalized.length
    while (start < end && normalized[start] === "_") start++
    while (end > start && normalized[end - 1] === "_") end--
    return normalized.slice(start, end).slice(0, 80)
}

const uniqueId = (candidate: string, used: ReadonlySet<string>): string => {
    let id = candidate
    let n = 2
    while (used.has(id)) {
        const separator = id.lastIndexOf("_")
        const suffix = id.slice(separator + 1)
        const stem = separator >= 0 && /^\d+$/u.test(suffix) ? id.slice(0, separator) : id
        id = `${stem}_${n}`
        n++
    }
    return id
}

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

const operationsOf = (doc: ApiJsonObject): Array<OpenApiOperation> => {
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
            const op = operationOf(doc, operation, method, path, shared, used)
            used.add(op.id)
            ops.push(op)
        }
    }
    return ops
}

const operationOf = (
    doc: ApiJsonObject,
    operation: ApiJsonObject,
    method: OpenApiOperation["method"],
    path: string,
    shared: ReadonlyArray<unknown>,
    used: ReadonlySet<string>,
): OpenApiOperation => {
    const own = Array.isArray(operation.parameters) ? operation.parameters : []
    const { params, hasBody } = paramsOf(doc, shared, own, isApiJsonObject(operation.requestBody))
    const candidate = cleanId(text(operation.operationId)) || cleanId(`${method.toLowerCase()}_${path}`)
    const summary = text(operation.summary) || text(operation.description)
    const suggest = method === "GET" ? suggestFor(doc, operation) : undefined
    return {
        id: uniqueId(candidate, used),
        method,
        path,
        summary: summary.replace(/\s+/gu, " ").slice(0, 120),
        params,
        hasBody,
        ...(suggest ? { suggest } : {}),
    }
}

/** Describes an already parsed OpenAPI 3.x / Swagger 2.0 document; throws a plain Vietnamese refusal when it is not one. */
export const describeSpec = (doc: unknown, specUrl: string): OpenApiSpec => {
    if (!isApiJsonObject(doc)) throw reject(OPENAPI_TEXT.notSpec)
    const isV3 = typeof doc.openapi === "string" && doc.openapi.startsWith("3")
    if (!isV3 && doc.swagger !== "2.0") throw reject(OPENAPI_TEXT.notSpec)
    const ops = operationsOf(doc)
    if (ops.length === 0) throw reject(OPENAPI_TEXT.noOperations)
    const info = isApiJsonObject(doc.info) ? doc.info : {}
    return { title: text(info.title).slice(0, 80), baseUrl: baseUrlOf(doc, specUrl), ops, authHint: authHintOf(doc) }
}
