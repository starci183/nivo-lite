import { Test } from "@nestjs/testing"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { TABLE_COPY } from "./messages/table.messages"
import { docExportUrl, isNotPublicAnswer, sheetExportUrl } from "./table-google.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("table-google.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sheetExportUrl, docExportUrl, isNotPublicAnswer } }],
    }).compile()
    return moduleRef.get<typeof import("./table-google.policy")>(SUBJECT)
}

const SHEET = "https://docs.google.com/spreadsheets/d/sheet-id-01/edit"
const DOC = "https://docs.google.com/document/d/doc-id-0001/edit"

describe("sheetExportUrl and docExportUrl", () => {
    it("exports the tab named by the query, the hash, or the first tab", async () => {
        const subject = await buildSubject()

        expect(subject.sheetExportUrl(`${SHEET}?gid=12`)).toBe(
            "https://docs.google.com/spreadsheets/d/sheet-id-01/export?format=csv&gid=12",
        )
        expect(subject.sheetExportUrl(`${SHEET}#gid=7`)).toBe(
            "https://docs.google.com/spreadsheets/d/sheet-id-01/export?format=csv&gid=7",
        )
        expect(subject.sheetExportUrl(`  ${SHEET}  `)).toBe(
            "https://docs.google.com/spreadsheets/d/sheet-id-01/export?format=csv&gid=0",
        )
        expect(subject.sheetExportUrl(`${SHEET}?gid=not-a-number`)).toContain("gid=0")
    })

    it("exports a document as text and keeps its id", async () => {
        const subject = await buildSubject()

        expect(subject.docExportUrl(DOC)).toEqual({
            url: "https://docs.google.com/document/d/doc-id-0001/export?format=txt",
            id: "doc-id-0001",
        })
    })

    it("refuses a link that is not a URL", async () => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.sheetExportUrl("not a url"))).toEqual(
            objectLike({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TABLE_COPY.sheetsLinkInvalid },
            }),
        )
        expect(thrownBy(() => subject.docExportUrl("not a url"))).toEqual(
            objectLike({ params: { detail: TABLE_COPY.docsLinkInvalid } }),
        )
    })

    it.each([
        ["http://docs.google.com/spreadsheets/d/sheet-id-01/edit", TABLE_COPY.sheetsLinkShape],
        ["https://sheets.google.com/spreadsheets/d/sheet-id-01/edit", TABLE_COPY.sheetsLinkShape],
        ["https://docs.google.com/spreadsheets/d/short/edit", TABLE_COPY.sheetsLinkShape],
        ["https://docs.google.com/document/d/sheet-id-01/edit", TABLE_COPY.sheetsLinkShape],
    ])("refuses a sheet link %s", async (link, detail) => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.sheetExportUrl(link))).toEqual(objectLike({ params: { detail } }))
    })

    it("refuses a document link with the wrong shape", async () => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.docExportUrl("https://docs.google.com/spreadsheets/d/doc-id-0001/edit"))).toEqual(
            objectLike({ params: { detail: TABLE_COPY.docsLinkShape } }),
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
    ])("treats status %s as not the exported data", async (status, contentType, text) => {
        const subject = await buildSubject()

        expect(subject.isNotPublicAnswer(status, contentType, text)).toBe(true)
    })

    it("accepts a CSV body", async () => {
        const subject = await buildSubject()

        expect(subject.isNotPublicAnswer(200, "text/csv", "a,b\n1,2")).toBe(false)
    })
})
