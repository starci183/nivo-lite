import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient, HttpRequest, HttpResponse } from "@modules/platform/http"
import { InjectDataSourcesOptions } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { isPrivateAddress, isWellFormedHost } from "./public-host.policy"
import { PUBLIC_HOST_TEXT } from "./messages/public-host.messages"

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

/** What a public request may carry. */
export interface PublicSendInit extends PublicGetInit {
    /** A JSON-serializable body, sent as application/json. */
    readonly json?: unknown
    /** Form fields, sent as application/x-www-form-urlencoded. */
    readonly form?: Readonly<Record<string, string>>
    /** Raw bytes sent as they are (the headers name their content-type). */
    readonly bytes?: Buffer
}

/** How many redirects a request follows, each checked before it is requested. */
const MAX_REDIRECTS = 3
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
        const answers = family === 0 ? await this.lookupAll(bare) : [{ address: bare, family }]
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
    get(rawUrl: string, init: PublicGetInit = {}): Promise<PublicResponse> {
        return this.send("GET", rawUrl, init)
    }

    /** Sends a request (GET, POST...) to a public http(s) URL with a time limit and a size cap; every hop of a redirect (at most 3) is resolved and checked before it is requested. */
    send(method: HttpRequest["method"], rawUrl: string, init: PublicSendInit = {}): Promise<PublicResponse> {
        return this.follow(method, new URL(rawUrl), new URL(rawUrl).origin, init, 0)
    }

    private async follow(
        method: HttpRequest["method"],
        url: URL,
        origin: string,
        init: PublicSendInit,
        hop: number,
    ): Promise<PublicResponse> {
        if (hop > MAX_REDIRECTS) {
            throw new DataSourcesError({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: PUBLIC_HOST_TEXT.tooManyRedirects },
            })
        }
        const answer = await this.hop(method, url, url.origin === origin ? init : { timeoutMs: init.timeoutMs })
        const location = answer.headers?.location
        if (answer.status < 300 || answer.status >= 400 || location === undefined) return this.checked(answer, init)
        return this.follow(method, new URL(location, url), origin, init, hop + 1)
    }

    private async hop(method: HttpRequest["method"], url: URL, init: PublicSendInit): Promise<HttpResponse> {
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new DataSourcesError({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: PUBLIC_HOST_TEXT.schemeOnly },
            })
        }
        const pin = await this.resolve(url.hostname)
        return this.http
            .request({
                method,
                url: url.toString(),
                headers: init.headers ?? {},
                ...(init.json !== undefined ? { body: init.json } : {}),
                ...(init.form !== undefined ? { form: init.form } : {}),
                ...(init.bytes !== undefined ? { bytes: init.bytes } : {}),
                read: "text",
                redirect: "manual",
                pin: { address: pin.address, family: pin.family },
                timeoutMs: init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            })
            .catch((cause: unknown) => {
                throw new DataSourcesError({
                    code: DataSourcesErrorCode.Unavailable,
                    params: { detail: PUBLIC_HOST_TEXT.unreachable },
                    cause,
                })
            })
    }

    private checked(answer: HttpResponse, init: PublicSendInit): PublicResponse {
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

    private lookupAll(host: string): Promise<ReadonlyArray<{ address: string; family: number }>> {
        return lookup(host, { all: true }).then(
            (records) => records,
            (cause: unknown) => {
                throw new DataSourcesError({ code: DataSourcesErrorCode.HostUnknown, params: { host }, cause })
            },
        )
    }
}
