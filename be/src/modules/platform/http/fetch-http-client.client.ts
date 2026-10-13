import { Injectable } from "@nestjs/common"
import { HttpError, HttpErrorCode } from "./errors/http.error"
import type { HttpClient, HttpRequest, HttpResponse } from "./http.port"
import { sendPinned } from "./pinned-request.client"

@Injectable()
/** The HttpClient adapter over the global `fetch`; the only place outside a spec that calls it. */
export class FetchHttpClient implements HttpClient {
    /** Sends `request` with its deadline and reads the body as the request asks: parsed JSON, text or raw bytes. */
    async request(request: HttpRequest): Promise<HttpResponse> {
        const deadline = AbortSignal.timeout(request.timeoutMs)
        const signal = request.signal ? AbortSignal.any([deadline, request.signal]) : deadline
        if (request.pin !== undefined) return this.pinned(request, request.pin, signal)
        const response = await this.send(request, signal)
        const answer = { status: response.status, headers: this.headersOf(response), url: response.url }
        if (request.read === "bytes") {
            return {
                ...answer,
                body: await this.received(response.arrayBuffer().then((bytes) => Buffer.from(bytes))),
            }
        }
        const text = await this.received(response.text())
        if (request.read === "text") return { ...answer, body: text }
        return { ...answer, body: text === "" ? undefined : this.parse(text) }
    }

    /** A request whose socket is opened to the pinned address; the body is read as the request asks. */
    private async pinned(
        request: HttpRequest,
        pin: NonNullable<HttpRequest["pin"]>,
        signal: AbortSignal,
    ): Promise<HttpResponse> {
        const answer = await sendPinned(new URL(request.url), pin, {
            method: request.method,
            headers: { ...this.contentTypeOf(request), ...request.headers },
            body: this.bodyOf(request),
            timeoutMs: request.timeoutMs,
            signal,
        })
        const base = { status: answer.status, headers: answer.headers, url: request.url }
        if (request.read === "bytes") return { ...base, body: answer.body }
        const text = answer.body.toString("utf8")
        if (request.read === "text") return { ...base, body: text }
        return { ...base, body: text === "" ? undefined : this.parse(text) }
    }

    /** The headers as a plain map with lower-case names. */
    private headersOf(response: Response): Record<string, string> {
        return Object.fromEntries(response.headers.entries())
    }

    /** The body as it arrives; a deadline or a cut while it streams is the same HttpError as one before the headers. */
    private async received<T>(reading: Promise<T>): Promise<T> {
        try {
            return await reading
        } catch (cause) {
            throw this.failure(cause)
        }
    }

    private failure(cause: unknown): HttpError {
        // The deadline rejects with a DOMException from the runtime's own realm: compare its name, never its prototype chain.
        const timedOut = typeof cause === "object" && cause !== null && "name" in cause && cause.name === "TimeoutError"
        return new HttpError({ code: timedOut ? HttpErrorCode.Timeout : HttpErrorCode.Network, cause })
    }

    private async send(request: HttpRequest, signal: AbortSignal): Promise<Response> {
        try {
            return await fetch(request.url, {
                method: request.method,
                headers: { ...this.contentTypeOf(request), ...request.headers },
                body: this.bodyOf(request),
                redirect: request.redirect ?? "follow",
                signal,
            })
        } catch (cause) {
            throw this.failure(cause)
        }
    }

    private contentTypeOf(request: HttpRequest): Record<string, string> {
        if (request.form !== undefined) return { "content-type": "application/x-www-form-urlencoded" }
        if (request.bytes !== undefined) return { "content-type": "application/octet-stream" }
        return request.body === undefined ? {} : { "content-type": "application/json" }
    }

    private bodyOf(request: HttpRequest): string | Buffer | undefined {
        if (request.form !== undefined) return new URLSearchParams(request.form).toString()
        if (request.bytes !== undefined) return request.bytes
        return request.body === undefined ? undefined : JSON.stringify(request.body)
    }

    private parse(text: string): unknown {
        try {
            return JSON.parse(text)
        } catch (cause) {
            throw new HttpError({ code: HttpErrorCode.BodyUnreadable, cause })
        }
    }
}
