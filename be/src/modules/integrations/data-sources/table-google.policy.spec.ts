import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { TABLE_COPY } from "./messages/table.messages"
import { docExportUrl, isNotPublicAnswer, sheetExportUrl } from "./table-google.policy"

const SHEET = "https://docs.google.com/spreadsheets/d/sheet-id-01/edit"
const DOC = "https://docs.google.com/document/d/doc-id-0001/edit"

describe("sheetExportUrl and docExportUrl", () => {
    it("exports the tab named by the query, the hash, or the first tab", () => {
        expect(sheetExportUrl(`${SHEET}?gid=12`)).toBe(
            "https://docs.google.com/spreadsheets/d/sheet-id-01/export?format=csv&gid=12",
        )
        expect(sheetExportUrl(`${SHEET}#gid=7`)).toBe(
            "https://docs.google.com/spreadsheets/d/sheet-id-01/export?format=csv&gid=7",
        )
        expect(sheetExportUrl(`  ${SHEET}  `)).toBe(
            "https://docs.google.com/spreadsheets/d/sheet-id-01/export?format=csv&gid=0",
        )
        expect(sheetExportUrl(`${SHEET}?gid=not-a-number`)).toContain("gid=0")
    })

    it("exports a document as text and keeps its id", () => {
        expect(docExportUrl(DOC)).toEqual({
            url: "https://docs.google.com/document/d/doc-id-0001/export?format=txt",
            id: "doc-id-0001",
        })
    })

    it("refuses a link that is not a URL", () => {
        expect(() => sheetExportUrl("not a url")).toThrow(
            expect.objectContaining({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TABLE_COPY.sheetsLinkInvalid },
            }),
        )
        expect(() => docExportUrl("not a url")).toThrow(
            expect.objectContaining({ params: { detail: TABLE_COPY.docsLinkInvalid } }),
        )
    })

    it.each([
        ["http://docs.google.com/spreadsheets/d/sheet-id-01/edit", TABLE_COPY.sheetsLinkShape],
        ["https://sheets.google.com/spreadsheets/d/sheet-id-01/edit", TABLE_COPY.sheetsLinkShape],
        ["https://docs.google.com/spreadsheets/d/short/edit", TABLE_COPY.sheetsLinkShape],
        ["https://docs.google.com/document/d/sheet-id-01/edit", TABLE_COPY.sheetsLinkShape],
    ])("refuses a sheet link %s", (link, detail) => {
        expect(() => sheetExportUrl(link)).toThrow(expect.objectContaining({ params: { detail } }))
    })

    it("refuses a document link with the wrong shape", () => {
        expect(() => docExportUrl("https://docs.google.com/spreadsheets/d/doc-id-0001/edit")).toThrow(
            expect.objectContaining({ params: { detail: TABLE_COPY.docsLinkShape } }),
        )
    })
})

describe("isNotPublicAnswer", () => {
    it.each([
        [401, "text/csv", "a,b"],
        [403, "text/csv", "a,b"],
        [404, "text/csv", "a,b"],
        [200, "text/html; charset=utf-8", "a,b"],
        [200, "text/csv", "  <!DOCTYPE html>"],
        [200, "text/csv", "<html><body>sign in</body></html>"],
    ])("treats status %s as not the exported data", (status, contentType, text) => {
        expect(isNotPublicAnswer(status, contentType, text)).toBe(true)
    })

    it("accepts a CSV body", () => {
        expect(isNotPublicAnswer(200, "text/csv", "a,b\n1,2")).toBe(false)
    })
})
