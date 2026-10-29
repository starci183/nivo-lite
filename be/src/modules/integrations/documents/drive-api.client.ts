import { Injectable } from "@nestjs/common"
import type { HttpResponse } from "@modules/platform/http"
import { DOCUMENT_TEXT_MAX_CHARS, DRIVE_MAX_BYTES, RENEWAL_GRANT_FIELD } from "./documents.contracts"
import type { DriveFileText, GoogleAccessToken } from "./documents.contracts"
import { InjectDocumentsOptions } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import { DocumentsHttpClient } from "./documents-http.client"
import { statusError } from "./documents-failure.policy"
import { DRIVE_MIME, driveReadMode, isDriveId } from "./drive-link.policy"
import type { DriveReadMode } from "./drive-link.policy"
import { metaFrom } from "./drive-meta.mapper"
import type { DriveMeta } from "./drive-meta.mapper"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"
import { bytesOf, fieldOf, textOf } from "./response-body.mapper"
import { textFromBytes } from "./text-extraction.mapper"
import { fileTextKind, sniffTextKind } from "./text-kind.policy"

/** How long a Drive call may take. */
const DRIVE_TIMEOUT_MS = 30_000

/** How long the token endpoint of Google may take. */
const TOKEN_TIMEOUT_MS = 15_000

/** What a Drive export is asked to produce for a Google-native file. */
const EXPORT_TYPE: Readonly<Record<Exclude<DriveReadMode, "media">, string>> = {
    doc: "text/plain",
    sheet: "text/csv",
    slides: "text/plain",
}

@Injectable()
/** Google Drive over its REST API: one file as text, the metadata calls a folder listing builds on, and the refresh of an access token. */
export class DriveApiClient {
    constructor(
        @InjectDocumentsOptions() private readonly options: DocumentsOptions,
        private readonly http: DocumentsHttpClient,
    ) {}

    /** The text of one Drive file the token can open (metadata first, so the type and size are checked before any download). */
    async readFile(token: string, fileId: string): Promise<DriveFileText> {
        if (!isDriveId(fileId)) throw new DocumentsError({ code: DocumentsErrorCode.DriveIdInvalid })
        const meta = await this.metaOf(token, fileId)
        const name = meta.name ?? fileId
        if (meta.mimeType === DRIVE_MIME.folder) {
            throw new DocumentsError({ code: DocumentsErrorCode.FolderUnsupported })
        }
        const mode = driveReadMode(meta.mimeType ?? "", name)
        if (mode === null) {
            throw new DocumentsError({
                code: DocumentsErrorCode.TypeUnsupported,
                params: { type: meta.mimeType ?? "unknown" },
            })
        }
        if (meta.size !== undefined && Number(meta.size) > DRIVE_MAX_BYTES) this.tooLarge()
        const id = encodeURIComponent(fileId)
        const base = this.options.driveBase
        const url =
            mode === "media"
                ? `${base}/files/${id}?alt=media&supportsAllDrives=true`
                : `${base}/files/${id}/export?mimeType=${encodeURIComponent(EXPORT_TYPE[mode])}`
        const response = await this.get(token, url)
        const bytes = bytesOf(response.body)
        if (bytes.length > DRIVE_MAX_BYTES) this.tooLarge()
        const text =
            mode === "media"
                ? await this.mediaText(name, bytes, response.headers?.["content-type"] ?? "")
                : new TextDecoder("utf-8").decode(bytes).replace(/^\ufeff/u, "")
        return { name, text: text.slice(0, DOCUMENT_TEXT_MAX_CHARS) }
    }

    /** A new access token for a provider renewal token. */
    async refreshAccessToken(renewalToken: string): Promise<GoogleAccessToken> {
        const google = this.options.google
        if (google === null) throw new DocumentsError({ code: DocumentsErrorCode.GoogleNotConfigured })
        const base = this.options.oauthBase ?? "https://oauth2.googleapis.com"
        const response = await this.http.postForm(
            `${base}/token`,
            {
                [RENEWAL_GRANT_FIELD]: renewalToken,
                client_id: google.clientId,
                client_secret: google.clientSecret.reveal(),
                grant_type: "refresh_token",
            },
            TOKEN_TIMEOUT_MS,
        )
        const body = this.http.jsonBody(response)
        if (response.status < 200 || response.status >= 300) {
            const error = fieldOf(body, "error")
            const code = textOf(error) ?? textOf(fieldOf(error, "status"))
            if (code === "invalid_grant") throw new DocumentsError({ code: DocumentsErrorCode.GoogleGrantRevoked })
            throw statusError(response.status)
        }
        const accessToken = textOf(fieldOf(body, "access_token"))
        if (accessToken === undefined) throw statusError(502)
        const expiresIn = fieldOf(body, "expires_in")
        return {
            accessToken,
            renewalToken: textOf(fieldOf(body, RENEWAL_GRANT_FIELD)) ?? null,
            expiresInSeconds: typeof expiresIn === "number" ? expiresIn : 3600,
        }
    }

    /** The metadata of one Drive item. */
    async metaOf(token: string, id: string): Promise<DriveMeta> {
        const fields = "id,name,mimeType,size,modifiedTime,trashed,shortcutDetails(targetId)"
        const url = `${this.options.driveBase}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`
        return metaFrom(this.http.jsonBody(await this.get(token, url)))
    }

    /** One authorised GET; 401 is a rejected token, 404 and most 403 mean the account cannot open the item. */
    async get(token: string, url: string): Promise<HttpResponse> {
        const response = await this.http.get(url, { Authorization: `Bearer ${token}` }, DRIVE_TIMEOUT_MS)
        if (response.status >= 200 && response.status < 300) return response
        if (response.status === 401) throw new DocumentsError({ code: DocumentsErrorCode.TokenRejected })
        const body = new TextDecoder("utf-8").decode(bytesOf(response.body))
        const rateLimited = /rateLimit|quota|userRateLimit/iu.test(body)
        if (response.status === 404 || (response.status === 403 && !rateLimited)) {
            throw new DocumentsError({ code: DocumentsErrorCode.DriveNoAccess })
        }
        throw statusError(response.status)
    }

    /** The text of a downloaded file: the name decides the kind, else the bytes and the content type do. */
    private mediaText(name: string, bytes: Uint8Array, contentType: string): Promise<string> {
        const kind = fileTextKind(name) ?? sniffTextKind(bytes, contentType)
        if (kind === null) {
            throw new DocumentsError({
                code: DocumentsErrorCode.TypeUnsupported,
                params: { type: contentType || "unknown" },
            })
        }
        return textFromBytes(kind, bytes, this.options.readers)
    }

    private tooLarge(): never {
        throw new DocumentsError({ code: DocumentsErrorCode.TooLarge, params: { maxMb: 10 } })
    }
}
