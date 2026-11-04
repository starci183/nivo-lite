import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { RemoteFilesError, RemoteFilesErrorCode } from "./errors/remote-files.error"
import type { RemoteFileAnswer, RemoteFileRequest } from "./remote-files.contracts"
import type { RemoteFiles } from "./remote-files.port"

/** True for a success status. */
const isSuccess = (status: number): boolean => status >= 200 && status <= 299

@Injectable()
/** The only caller of the HTTP port for a file at a remote address: it asks once, within the deadline, and keeps out what is too large or of a type the caller does not accept. */
export class RemoteFilesClient implements RemoteFiles {
    constructor(@InjectHttpClient() private readonly http: HttpClient) {}

    /** Asks the address once; a network failure or a timeout is a `RemoteFilesError`, every answer (a redirect or a refusal too) is described. */
    async read(request: RemoteFileRequest): Promise<RemoteFileAnswer> {
        const answer = await this.http
            .request({
                method: "GET",
                url: request.url,
                read: "bytes",
                timeoutMs: request.timeoutMs,
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
        const kept = body !== null && isSuccess(answer.status) && request.accepts(contentType)
        return {
            status: answer.status,
            contentType,
            location: answer.headers?.location,
            length,
            bytes: kept && length > 0 && length <= request.maxBytes ? body : null,
        }
    }
}
