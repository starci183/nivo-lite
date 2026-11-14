import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient } from "@modules/platform/http"
import { InjectSandboxLoopbackPort } from "./provider-sandbox.decorators"
import type { SandboxWebhookPost, SandboxWebhookPoster, SandboxWebhookReply } from "./sandbox-webhook-poster.port"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"

/** How long one loopback webhook call may take (the route's own intake runs inside it). */
const POST_TIMEOUT_MS = 30_000

/** The reply's text as JSON when it is JSON, else the text itself (a route may answer plain text). */
const bodyOf = (text: unknown): unknown => {
    if (typeof text !== "string" || text === "") return null
    try {
        return JSON.parse(text) as unknown
    } catch {
        return text
    }
}

@Injectable()
/**
 * The poster of the api (R62, decision recorded in the concept): an inbound case is POSTed over HTTP to `http://127.0.0.1:<port>/<path>`,
 * this api's own listener, never another host. Chosen over an in-process call of the controller because only a real request runs the
 * route's raw-body capture, rate limit, pipes and guard exactly as the provider's call does; an in-process call would skip them.
 */
export class SandboxLoopbackPosterService implements SandboxWebhookPoster {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectSandboxLoopbackPort() private readonly port: number | undefined,
    ) {}

    /** Posts one call to the api's own listener and answers its status and body (an error status is answered, not thrown). */
    async post(call: SandboxWebhookPost): Promise<SandboxWebhookReply> {
        if (this.port === undefined) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.Off })
        const reply = await this.http.request({
            method: "POST",
            url: `http://127.0.0.1:${String(this.port)}/${call.path.replace(/^\/+/u, "")}`,
            headers: { ...call.headers },
            body: call.body,
            timeoutMs: POST_TIMEOUT_MS,
            read: "text",
        })
        return { status: reply.status, body: bodyOf(reply.body) }
    }
}
