import { Injectable } from "@nestjs/common"
import { DOCUMENT_TEXT_MAX_CHARS, LINK_MAX_BYTES } from "./documents.contracts"
import type { DocumentText } from "./documents.contracts"
import { InjectDocumentsOptions } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import { DocumentsHttpClient } from "./documents-http.client"
import { statusError } from "./documents-failure.policy"
import type { LinkTarget } from "./drive-link.policy"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"
import { htmlToText, pageTitle } from "./html-text.mapper"
import { isPublicHost } from "./public-host.policy"
import { bytesOf } from "./response-body.mapper"
import { textFromBytes } from "./text-extraction.mapper"
import { sniffTextKind } from "./text-kind.policy"

/** A link target with an address to fetch: a web page, a Google file or a Drive file. */
export type FetchableTarget = Extract<LinkTarget, { readonly fetchUrl: string }>

/** The address a Google sign-in wall lives at: a Google file that redirects there is not public. */
const GOOGLE_SIGN_IN_HOST = "accounts.google.com"

/** How long a link may take to answer. */
const LINK_TIMEOUT_MS = 10_000

/** How much of a page is read as HTML. */
const HTML_READ_BYTES = 1_000_000

@Injectable()
/** Reads a public address: a web page, a text, PDF or Office file, or the public export of a Google file. */
export class PublicLinkClient {
    constructor(
        @InjectDocumentsOptions() private readonly options: DocumentsOptions,
        private readonly http: DocumentsHttpClient,
    ) {}

    /** The text and title at the address of `target`. A Google file that is not shared publicly is `DOCUMENTS_NOT_PUBLIC`. */
    async read(target: FetchableTarget): Promise<DocumentText> {
        const url = new URL(target.fetchUrl)
        if (!isPublicHost(url.hostname)) throw new DocumentsError({ code: DocumentsErrorCode.HostPrivate })
        const google = target.kind !== "web"
        const response = await this.http.get(url.toString(), { "User-Agent": "NIVO-OS-Knowledge/1.0" }, LINK_TIMEOUT_MS)
        const finalHost = new URL(response.url === undefined || response.url === "" ? url : response.url).hostname
        const refused = response.status === 401 || response.status === 403 || response.status === 404
        if (google && (refused || finalHost === GOOGLE_SIGN_IN_HOST)) {
            throw new DocumentsError({ code: DocumentsErrorCode.NotPublic })
        }
        if (response.status < 200 || response.status >= 300) throw statusError(response.status)
        const bytes = bytesOf(response.body)
        if (bytes.length > LINK_MAX_BYTES) {
            throw new DocumentsError({ code: DocumentsErrorCode.TooLarge, params: { maxMb: 12 } })
        }
        const type = response.headers?.["content-type"] ?? ""
        const kind = sniffTextKind(bytes, type)
        if (kind !== null) {
            const text = await textFromBytes(kind, bytes, this.options.readers)
            return { text: text.slice(0, DOCUMENT_TEXT_MAX_CHARS), title: null }
        }
        if (!/html/iu.test(type)) {
            throw new DocumentsError({
                code: DocumentsErrorCode.TypeUnsupported,
                params: { type: type.split(";")[0] || "unknown" },
            })
        }
        // A Google export that answers with a page is the sign-in wall or the Drive virus-scan page: not readable as a public file.
        if (google) throw new DocumentsError({ code: DocumentsErrorCode.NotPublic })
        const html = new TextDecoder("utf-8").decode(bytes.subarray(0, HTML_READ_BYTES))
        return { text: htmlToText(html).slice(0, DOCUMENT_TEXT_MAX_CHARS), title: pageTitle(html) }
    }
}
