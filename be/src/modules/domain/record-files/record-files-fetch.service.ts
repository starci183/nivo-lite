import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Injectable, Optional } from "@nestjs/common"
import { fileMimeOf, mimeAccepted, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { InjectRemoteFiles, type RemoteFileAnswer, type RemoteFiles } from "@modules/integrations/remote-files"
import type { HttpPin } from "@modules/platform/http"
import { isPrivateAddress } from "@modules/platform/primitives"
import { RecordFilesError, RecordFilesErrorCode } from "./errors/record-files.error"
import { REMOTE_FETCH_MAX_BYTES, REMOTE_FETCH_TIMEOUT_MS, remoteUrlOf } from "./record-files-remote.policy"

/** A file fetched from a remote address: its bytes and the content type the answer declared (no parameters, lower case). */
export interface FetchedFile {
    /** The body of the answer. */
    readonly bytes: Uint8Array
    /** The declared content type, without parameters, in lower case. */
    readonly mime: string
}

/** True for a success status. */
const isSuccess = (status: number): boolean => status >= 200 && status <= 299

/** True for a redirect status. */
const isRedirect = (status: number): boolean => status >= 300 && status <= 399

@Injectable()
/**
 * Fetches the file a provider's result names by address, for a put onto a record: public https only; every hop (a redirect included,
 * at most the integration's limit) resolves the host first and refuses a loopback, private, link-local or metadata answer, then
 * connects to THAT address; the answer must declare a content type the field accepts and stay within the field's `maxBytes`.
 * The size is held to the field's `maxBytes` before the download (the declared length) and during it (the read stops at the limit),
 * under the file store's own 100 MiB ceiling; the deadline is the store's, in minutes. Other callers of the integration keep its defaults.
 * The body is buffered whole in memory before it is written to the store (the storage port takes no stream): about twice the file at the end of the read.
 */
export class RecordFileFetchService {
    constructor(@Optional() @InjectRemoteFiles() private readonly remote?: RemoteFiles) {}

    /** The file at `raw` for `field`, or the refusal why it cannot be kept: `UrlInvalid`, `UrlUnreachable`, `MimeNotAccepted`, `SizeInvalid`. */
    async fetch(raw: string, field: FieldDef): Promise<FetchedFile> {
        const remote = this.remote
        if (remote === undefined) throw new RecordFilesError({ code: RecordFilesErrorCode.FetchNotServed })
        const file = await this.follow(remote, remoteUrlOf(raw), field, 0)
        return file
    }

    /** One hop of the fetch: reads `url`, and a redirect (while the integration's limit allows) goes on to the hop after it. */
    private async follow(remote: RemoteFiles, url: URL, field: FieldDef, hop: number): Promise<FetchedFile> {
        if (hop > remote.maxRedirects) throw new RecordFilesError({ code: RecordFilesErrorCode.UrlUnreachable })
        const accept = field.accept ?? []
        const pin = await this.pinned(url.hostname)
        const answer = await remote
            .read({
                url: url.toString(),
                pin,
                redirect: "manual",
                maxBytes: field.maxBytes ?? 0,
                timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
                limits: { maxBytes: REMOTE_FETCH_MAX_BYTES, timeoutMs: REMOTE_FETCH_TIMEOUT_MS },
                accepts: (contentType) => mimeAccepted(accept, fileMimeOf(contentType)),
            })
            .catch((cause: unknown) => {
                throw new RecordFilesError({ code: RecordFilesErrorCode.UrlUnreachable, cause })
            })
        if (isRedirect(answer.status) && answer.location !== undefined) {
            return this.follow(remote, remoteUrlOf(new URL(answer.location, url).toString()), field, hop + 1)
        }
        return this.judged(answer, accept)
    }

    /** What an answer is: the file, or why it is none. */
    private judged(answer: RemoteFileAnswer, accept: ReadonlyArray<string>): FetchedFile {
        if (answer.bytes !== null) return { bytes: answer.bytes, mime: fileMimeOf(answer.contentType) }
        if (!isSuccess(answer.status) || answer.length < 1) {
            throw new RecordFilesError({ code: RecordFilesErrorCode.UrlUnreachable })
        }
        const refusal = mimeAccepted(accept, fileMimeOf(answer.contentType))
            ? RecordFilesErrorCode.SizeInvalid
            : RecordFilesErrorCode.MimeNotAccepted
        throw new RecordFilesError({ code: refusal })
    }

    /** The public address a host resolves to, to connect to; a host with any private answer is refused. */
    private async pinned(host: string): Promise<HttpPin> {
        const bare = host.replaceAll(/^\[|\]$/gu, "")
        const family = isIP(bare)
        const answers =
            family === 0
                ? await lookup(bare, { all: true }).catch((cause: unknown) => {
                      throw new RecordFilesError({ code: RecordFilesErrorCode.UrlUnreachable, cause })
                  })
                : [{ address: bare, family }]
        const first = answers[0]
        if (first === undefined) throw new RecordFilesError({ code: RecordFilesErrorCode.UrlUnreachable })
        if (answers.some((answer) => isPrivateAddress(answer.address))) {
            throw new RecordFilesError({ code: RecordFilesErrorCode.UrlInvalid })
        }
        return { address: first.address, family: first.family === 6 ? 6 : 4 }
    }
}
