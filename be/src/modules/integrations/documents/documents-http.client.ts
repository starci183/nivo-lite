import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DocumentsLogEvent } from "./documents.log-events"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"
import { bytesOf } from "./response-body.mapper"

@Injectable()
/** The one door of the documents integration to the network: a failure to reach the other side is `DOCUMENTS_UNAVAILABLE` with status 0. */
export class DocumentsHttpClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Reads `url` with a GET; the body comes back as bytes whatever the other side answers. */
    async get(url: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<HttpResponse> {
        try {
            return await this.http.request({ method: "GET", url, headers, read: "bytes", timeoutMs })
        } catch (cause) {
            throw new DocumentsError({ code: DocumentsErrorCode.Unavailable, params: { status: 0 }, cause })
        }
    }

    /** Posts form fields and answers the response with its body as bytes. */
    async postForm(url: string, form: Readonly<Record<string, string>>, timeoutMs: number): Promise<HttpResponse> {
        try {
            return await this.http.request({ method: "POST", url, form, read: "bytes", timeoutMs })
        } catch (cause) {
            throw new DocumentsError({ code: DocumentsErrorCode.Unavailable, params: { status: 0 }, cause })
        }
    }

    /** The JSON in the body of a response read as bytes; undefined, and logged, when the body is not JSON. */
    jsonBody(response: HttpResponse): unknown {
        try {
            return JSON.parse(new TextDecoder("utf-8").decode(bytesOf(response.body)))
        } catch (cause) {
            this.logger.error(DocumentsLogEvent.BodyUnreadable, cause, { status: response.status })
            return undefined
        }
    }
}
