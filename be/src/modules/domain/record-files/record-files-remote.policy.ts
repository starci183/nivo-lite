import { FILE_REMOTE_URL_MAX } from "@nivo-lite/agent-sdk/entity"
import { isWellFormedHost } from "@modules/platform/primitives"
import { RecordFilesError, RecordFilesErrorCode } from "./errors/record-files.error"

/** How long one fetch of a remote file may take, milliseconds: a composed video is hundreds of megabytes, so the wait is minutes, not the integration's seconds. */
export const REMOTE_FETCH_TIMEOUT_MS = 300_000

/**
 * The most bytes a put by address may fetch, whatever a field declares (100 MiB, while the store holds a file whole in memory): the file store's own ceiling over the remote files
 * integration's default, which every other caller keeps. The field's `maxBytes` is the real limit and is held first, and while the body arrives.
 */
export const REMOTE_FETCH_MAX_BYTES: number = 100 * 1024 * 1024

/**
 * The address of a remote file once it is a public https address: no other scheme, no credentials, a well-formed host name or an IP
 * literal. `UrlInvalid` otherwise. Whether the host resolves to a public address is checked where it is resolved, at every hop.
 */
export const remoteUrlOf = (raw: string): URL => {
    const invalid = new RecordFilesError({ code: RecordFilesErrorCode.UrlInvalid })
    if (raw.length > FILE_REMOTE_URL_MAX) throw invalid
    const url = URL.canParse(raw) ? new URL(raw) : null
    if (url?.protocol !== "https:" || url.username !== "" || url.password !== "") throw invalid
    const host = url.hostname.replaceAll(/^\[|\]$/gu, "")
    if (host === "" || (!host.includes(":") && !isWellFormedHost(host))) throw invalid
    return url
}
