import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Injectable } from "@nestjs/common"
import { isPrivateAddress, isWellFormedHost } from "@modules/integrations/mail"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectDataSourcesOptions } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"

/** The address a connection is opened to: connect to THIS address, not the name, so the answer cannot change between check and use. */
export interface ResolvedHost {
    /** The IP address to connect to. */
    readonly address: string
    /** The IP family of the address. */
    readonly family: 4 | 6
}

/** What a public GET answered. */
export interface PublicResponse {
    /** The HTTP status. */
    readonly status: number
    /** The response headers, names in lower case. */
    readonly headers: Readonly<Record<string, string>>
    /** The body as text. */
    readonly text: string
}

/** What a public GET may be asked for. */
export interface PublicGetInit {
    /** Request headers. */
    readonly headers?: Readonly<Record<string, string>>
    /** How long to wait. */
    readonly timeoutMs?: number
    /** The largest accepted answer in bytes. */
    readonly maxBytes?: number
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 5_000_000

@Injectable()
/** Refuses loopback, private, link-local, CGNAT and metadata addresses, so a connector can never be pointed at NIVO's own network. */
export class PublicHostClient {
    constructor(
        @InjectDataSourcesOptions() private readonly options: DataSourcesOptions,
        @InjectHttpClient() private readonly http: HttpClient,
    ) {}

    /** True when private addresses may be reached (a development site). */
    allowsPrivate(): boolean {
        return this.options.allowPrivateHosts
    }

    /** Resolves a host the owner typed and refuses a private answer; throws a DataSourcesError. */
    async resolve(host: string): Promise<ResolvedHost> {
        const bare = host.trim().replace(/^\[|\]$/gu, "")
        const family = isIP(bare)
        if (family === 0 && !isWellFormedHost(bare)) {
            throw new DataSourcesError({ code: DataSourcesErrorCode.HostInvalid })
        }
        const answers = family === 0 ? await lookup(bare, { all: true }).catch(() => []) : [{ address: bare, family }]
        const first = answers[0]
        if (first === undefined) {
            throw new DataSourcesError({ code: DataSourcesErrorCode.HostUnknown, params: { host: bare } })
        }
        if (!this.options.allowPrivateHosts && answers.some((answer) => isPrivateAddress(answer.address))) {
            throw new DataSourcesError({ code: DataSourcesErrorCode.HostPrivate, params: { host: bare } })
        }
        return { address: first.address, family: first.family === 6 ? 6 : 4 }
    }

    /** GETs a public http(s) URL with a time limit and a size cap; the host is checked first and so is the address the answer came from. */
    async get(rawUrl: string, init: PublicGetInit = {}): Promise<PublicResponse> {
        const url = new URL(rawUrl)
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new DataSourcesError({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: "Chỉ hỗ trợ địa chỉ http hoặc https." },
            })
        }
        await this.resolve(url.hostname)
        const answer = await this.http
            .request({
                method: "GET",
                url: url.toString(),
                headers: init.headers ?? {},
                read: "text",
                timeoutMs: init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            })
            .catch((cause: unknown) => {
                throw new DataSourcesError({
                    code: DataSourcesErrorCode.Unavailable,
                    params: { detail: "Không kết nối được tới máy chủ. Hãy thử lại sau." },
                    cause,
                })
            })
        if (answer.url !== undefined) await this.resolve(new URL(answer.url).hostname)
        const text = typeof answer.body === "string" ? answer.body : ""
        const max = init.maxBytes ?? DEFAULT_MAX_BYTES
        if (Buffer.byteLength(text) > max) {
            throw new DataSourcesError({
                code: DataSourcesErrorCode.TooLarge,
                params: { limit: `${Math.round(max / 1_000_000)} MB` },
            })
        }
        return { status: answer.status, headers: answer.headers ?? {}, text }
    }
}
