import { TABLE_COPY } from "./messages/table.messages"
import type { GoogleExport, GoogleLinkParts } from "./table-shapes.contracts"
import { rejected } from "./table-rows.policy"

const GOOGLE_ID = /^[A-Za-z0-9_-]{10,200}$/u
const GOOGLE_HOST = "docs.google.com"

type GoogleKind = "spreadsheets" | "document"

const googleLink = (raw: string, kind: GoogleKind): GoogleLinkParts => {
    const invalid = kind === "spreadsheets" ? TABLE_COPY.sheetsLinkInvalid : TABLE_COPY.docsLinkInvalid
    let url: URL
    try {
        url = new URL(raw.trim())
    } catch (cause) {
        throw rejected(invalid, cause)
    }
    const id = new RegExp(`^/${kind}/d/([^/]+)`, "u").exec(url.pathname)?.[1] ?? ""
    if (url.protocol !== "https:" || url.hostname !== GOOGLE_HOST || !GOOGLE_ID.test(id)) {
        throw rejected(
            kind === "spreadsheets" ? TABLE_COPY.sheetsLinkShape : TABLE_COPY.docsLinkShape,
        )
    }
    const gid = url.searchParams.get("gid") ?? /gid=(\d+)/u.exec(url.hash)?.[1] ?? "0"
    return { id, gid: /^\d{1,20}$/u.test(gid) ? gid : "0" }
}

/** A pasted Google Sheets link to the CSV export address of that tab. */
export const sheetExportUrl = (link: string): string => {
    const { id, gid } = googleLink(link, "spreadsheets")
    return `https://${GOOGLE_HOST}/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
}

/** A pasted Google Docs link to the plain text export address, plus the document id. */
export const docExportUrl = (link: string): GoogleExport => {
    const { id } = googleLink(link, "document")
    return { url: `https://${GOOGLE_HOST}/document/d/${id}/export?format=txt`, id }
}

/** True when a Google answer is a sign-in or error page rather than the exported data. */
export const isNotPublicAnswer = (status: number, contentType: string, text: string): boolean =>
    status === 401 ||
    status === 403 ||
    status === 404 ||
    contentType.includes("text/html") ||
    /^\s*<(!doctype|html)/iu.test(text)
