import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { RemoteFilesError, RemoteFilesErrorCode } from "./errors/remote-files.error"
import type { RemoteFileAnswer, RemoteFileRequest } from "./remote-files.contracts"
import { InjectRemoteFilesOptions } from "./remote-files.decorators"
import type { RemoteFilesOptions } from "./remote-files.options"
import type { RemoteFiles } from "./remote-files.port"

/** True for a success status. */
const isSuccess = (status: number): boolean => status >= 200 && status <= 299

@Injectable()
/** The only caller of the HTTP port for a file at a remote address: it asks once, within the deadline, and keeps out what is too large or of a type the caller does not accept; the caller's size and deadline never exceed the configured limits. */
export class RemoteFilesClient implements RemoteFiles {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectRemoteFilesOptions() private readonly options: RemoteFilesOptions,
    ) {}

    /** How many redirects a caller that follows them hop by hop may follow. */
    get maxRedirects(): number {
        return this.options.maxRedirects
    }

    /** Asks the address once; a network failure or a timeout is a `RemoteFilesError`, every answer (a redirect or a refusal too) is described. */
    async read(request: RemoteFileRequest): Promise<RemoteFileAnswer> {
        const answer = await this.http
            .request({
                method: "GET",
                url: request.url,
                read: "bytes",
                timeoutMs: Math.min(request.timeoutMs, this.options.timeoutMs),
                ...(request.headers === undefined ? {} : { headers: request.headers }),
                ...(request.pin === undefined ? {} : { pin: request.pin }),
                ...(request.redirect === undefined ? {} : { redirect: request.redirect }),
            })
            .catch((cause: unknown) => {
                throw new RemoteFilesError({ code: RemoteFilesErrorCode.RequestFailed, cause })
            })
        const contentType = answer.headers?.["content-type"] ?? ""
        const body = Buffer.isBuffer(answer.body) ? answer.body : null
        const length = body?.length ?? 0
        const maxBytes = Math.min(request.maxBytes, this.options.maxBytes)
        const kept = body !== null && isSuccess(answer.status) && request.accepts(contentType)
        return {
            status: answer.status,
            contentType,
            location: answer.headers?.location,
            length,
            bytes: kept && length > 0 && length <= maxBytes ? body : null,
        }
    }
}
