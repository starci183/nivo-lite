import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import type { OpenApiCall } from "./openapi.contracts"
import { OPENAPI_TEXT, missingPathParam } from "./messages/openapi.messages"

/** The request to send for one call. */
export interface BuiltRequest {
    /** The full URL. */
    readonly url: URL
    /** The headers. */
    readonly headers: Record<string, string>
    /** The JSON text of the body, when there is one. */
    readonly body: string | undefined
}

const reject = (detail: string): DataSourcesError =>
    new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail } })

const filled = (value: unknown): value is string | number | boolean =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const valueText = (value: unknown): string => (filled(value) ? String(value) : "")

/** Builds the URL, headers and body of one call from the operation, the credential and the parameter values. */
export const buildRequest = (call: OpenApiCall): BuiltRequest => {
    const { baseUrl, op, auth, input } = call
    if (!/^https?:\/\//iu.test(baseUrl)) throw reject(OPENAPI_TEXT.baseUrlScheme)
    let url: URL
    if (call.link === undefined) {
        let path = op.path
        for (const param of op.params.filter((p) => p.in === "path")) {
            const value = valueText(input[param.name])
            if (value === "") throw reject(missingPathParam(param.name))
            path = path.split(`{${param.name}}`).join(encodeURIComponent(value))
        }
        url = new URL(baseUrl.replace(/\/+$/u, "") + path)
        for (const [key, value] of new URLSearchParams(call.fixedQuery ?? "")) url.searchParams.set(key, value)
        for (const param of op.params.filter((p) => p.in === "query")) {
            const value = valueText(input[param.name])
            if (value !== "") url.searchParams.set(param.name, value)
        }
    } else {
        url = new URL(call.link)
    }
    const headers: Record<string, string> = { accept: "application/json" }
    if (call.link === undefined) {
        for (const param of op.params.filter((p) => p.in === "header")) {
            const value = valueText(input[param.name])
            if (value !== "") headers[param.name] = value
        }
    }
    if (auth.type === "header" && auth.name && auth.value) headers[auth.name] = auth.value
    else if (auth.type === "query" && auth.name && auth.value) url.searchParams.set(auth.name, auth.value)
    else if (auth.type === "bearer" && auth.value) headers.authorization = `Bearer ${auth.value}`
    else if (auth.type === "basic" && (auth.user || auth.password)) {
        headers.authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString("base64")}`
    }
    let body: string | undefined
    if (op.method !== "GET" && input.body !== undefined) {
        body = typeof input.body === "string" ? input.body : JSON.stringify(input.body)
        headers["content-type"] = "application/json"
    }
    return { url, headers, body }
}
