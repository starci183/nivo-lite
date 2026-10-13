import { Injectable } from "@nestjs/common"
import { parse as parseYaml } from "yaml"
import { InjectPublicHost } from "./data-sources.decorators"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import type { OpenApiAnswer, OpenApiCall, OpenApiSpec } from "./openapi.contracts"
import { OPENAPI_TEXT, specDownloadFailure } from "./messages/openapi.messages"
import { readApiJson } from "./openapi-items.policy"
import { buildRequest } from "./openapi-request.policy"
import { describeSpec } from "./openapi-spec.policy"
import type { PublicHostClient } from "./public-host.client"

const SPEC_LIMIT_BYTES = 5_000_000
const CALL_TIMEOUT_MS = 15_000
const CALL_MAX_BYTES = 5_000_000

const reject = (detail: string, cause?: unknown): DataSourcesError =>
    new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail }, cause })

@Injectable()
/** The client that reads the spec of the owner's own API and calls its operations with the configured authentication. */
export class OpenApiClient {
    constructor(@InjectPublicHost() private readonly publicHost: PublicHostClient) {}

    /** Downloads a spec from a link (https; http only on a development site) and answers its text. */
    async fetchSpec(specUrl: string): Promise<string> {
        if (!URL.canParse(specUrl)) throw reject(OPENAPI_TEXT.badSpecLink)
        const url = new URL(specUrl)
        if (url.protocol !== "https:" && !(url.protocol === "http:" && this.publicHost.allowsPrivate())) {
            throw reject(OPENAPI_TEXT.httpsSpecLink)
        }
        const answer = await this.publicHost.get(url.toString(), {
            headers: { accept: "application/json, application/yaml, text/yaml, */*" },
            maxBytes: SPEC_LIMIT_BYTES,
        })
        if (answer.status < 200 || answer.status >= 300) throw reject(specDownloadFailure(answer.status))
        return answer.text
    }

    /** Reads a JSON or YAML spec (OpenAPI 3.x or Swagger 2.0) and lists its operations. */
    parseSpec(raw: string, specUrl: string): OpenApiSpec {
        const trimmed = raw.trim()
        if (trimmed === "") throw reject(OPENAPI_TEXT.emptySpec)
        const json = readApiJson(trimmed)
        if (json.cause === undefined) return describeSpec(json.value, specUrl)
        try {
            const doc: unknown = parseYaml(trimmed)
            return describeSpec(doc, specUrl)
        } catch (cause) {
            if (cause instanceof DataSourcesError) throw cause
            throw reject(OPENAPI_TEXT.unreadableSpec, cause)
        }
    }

    /** Calls one operation (or a next-page link) of the owner's API; a non-2xx status is answered, not thrown. */
    call(call: OpenApiCall): Promise<OpenApiAnswer> {
        const { url, headers, body } = buildRequest(call)
        return this.publicHost.send(call.op.method, url.toString(), {
            headers,
            timeoutMs: CALL_TIMEOUT_MS,
            maxBytes: call.maxBytes ?? CALL_MAX_BYTES,
            ...(body === undefined ? {} : { bytes: Buffer.from(body) }),
        })
    }
}
