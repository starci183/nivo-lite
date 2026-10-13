import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PUBLIC_HOST } from "./data-sources.decorators"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { TABLE_COPY } from "./messages/table.messages"
import { TABLE_MAX_BYTES } from "./table-shapes.contracts"
import { TableClient } from "./table.client"
import type { PublicHostClient, PublicResponse } from "./public-host.client"

class MockWorkbook {
    error: Error | undefined = undefined
    sheets: Array<{ sheet: string; data: Array<Array<string>> }> = []
}
class MockWord {
    text = "word"
    error: Error | undefined = undefined
}
class MockPdf {
    text = "pdf"
    pages = 2
    error: Error | undefined = undefined
}
const mockWorkbook = new MockWorkbook()
const mockWord = new MockWord()
const mockPdf = new MockPdf()

jest.mock("read-excel-file/universal", () => ({
    __esModule: true,
    default: () =>
        mockWorkbook.error === undefined ? Promise.resolve(mockWorkbook.sheets) : Promise.reject(mockWorkbook.error),
}))

jest.mock("mammoth", () => ({
    extractRawText: () =>
        mockWord.error === undefined ? Promise.resolve({ value: mockWord.text }) : Promise.reject(mockWord.error),
}))

jest.mock("unpdf", () => ({
    getDocumentProxy: () => Promise.resolve({}),
    extractText: () =>
        mockPdf.error === undefined
            ? Promise.resolve({ text: mockPdf.text, totalPages: mockPdf.pages })
            : Promise.reject(mockPdf.error),
}))

const csv = (text: string): Uint8Array => new TextEncoder().encode(text)
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])
const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04])

const build = async () => {
    const publicHost = mock<PublicHostClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [TableClient, { provide: PUBLIC_HOST, useValue: publicHost }],
    }).compile()
    return { client: moduleRef.get(TableClient), publicHost }
}

const google = (partial: Partial<PublicResponse>): PublicResponse => ({
    status: 200,
    headers: { "content-type": "text/csv" },
    text: "Name\nAn",
    ...partial,
})

describe("TableClient", () => {
    beforeEach(() => {
        mockWorkbook.error = undefined
        mockWorkbook.sheets = []
        mockWord.text = "word"
        mockWord.error = undefined
        mockPdf.text = "pdf"
        mockPdf.pages = 2
        mockPdf.error = undefined
    })

    describe("readText and readGrid", () => {
        it("detects a delimiter and ignores a quote error when rows remain", async () => {
            const { client } = await build()

            expect(client.readText("Name;Qty\nAn;2")).toEqual({
                headers: ["Name", "Qty"],
                rows: [["An", "2"]],
                delimiter: ";",
                sheets: [],
                sheet: "",
            })
            expect(client.readText('a,"b,c')).toMatchObject({ headers: ["a", "b,c"], rows: [] })
            expect(client.readGrid(["Name"], [["An"]])).toEqual({
                headers: ["Name"],
                rows: [["An"]],
                delimiter: "",
                sheets: [],
                sheet: "",
            })
        })

        it("refuses text with no rows", async () => {
            const { client } = await build()

            expect(() => client.readText("")).toThrow(
                expect.objectContaining({ params: { detail: TABLE_COPY.noData } }),
            )
        })
    })

    describe("readFile", () => {
        it("reads a csv and refuses an empty, oversized, unknown or binary file", async () => {
            const { client } = await build()

            await expect(client.readFile("orders.csv", csv("Name\nAn"))).resolves.toMatchObject({
                headers: ["Name"],
                rows: [["An"]],
            })
            await expect(client.readFile("orders.csv", new Uint8Array())).rejects.toMatchObject({
                params: { detail: TABLE_COPY.fileEmpty },
            })
            await expect(client.readFile("orders.csv", new Uint8Array(TABLE_MAX_BYTES + 1))).rejects.toMatchObject({
                params: { detail: TABLE_COPY.fileTooLarge },
            })
            await expect(client.readFile("orders.xls", csv("Name"))).rejects.toMatchObject({
                params: { detail: TABLE_COPY.onlyTables },
            })
            await expect(client.readFile("orders.csv", new Uint8Array([0, 1, 2]))).rejects.toMatchObject({
                params: { detail: TABLE_COPY.notCsvText },
            })
            await expect(client.readFile("orders.xlsx", csv("Name"))).rejects.toMatchObject({
                params: { detail: TABLE_COPY.badXlsx },
            })
        })

        it("reads the named sheet, else the first, and refuses an unreadable or empty workbook", async () => {
            const { client } = await build()
            mockWorkbook.sheets = [
                { sheet: "First", data: [["Name"], ["An"]] },
                { sheet: "Second", data: [["Name"], ["Bo"]] },
            ]

            await expect(client.readFile("orders.xlsx", zip, "Second")).resolves.toMatchObject({
                headers: ["Name"],
                rows: [["Bo"]],
                sheets: ["First", "Second"],
                sheet: "Second",
            })
            await expect(client.readFile("orders.xlsx", zip)).resolves.toMatchObject({ sheet: "First", rows: [["An"]] })

            mockWorkbook.sheets = []
            await expect(client.readFile("orders.xlsx", zip)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.noSheets },
            })
            const cause = new Error("bad zip")
            mockWorkbook.error = cause
            await expect(client.readFile("orders.xlsx", zip)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.unreadableExcel },
                cause,
            })
        })
    })

    describe("readDocumentFile", () => {
        it("reads text and refuses the wrong kind or a binary text file", async () => {
            const { client } = await build()

            await expect(client.readDocumentFile("notes\\story.md", csv("hello"))).resolves.toEqual({ text: "hello" })
            await expect(client.readDocumentFile("notes.csv", csv("hello"))).rejects.toMatchObject({
                params: { detail: TABLE_COPY.onlyDocuments("notes.csv") },
            })
            await expect(
                client.readDocumentFile(`dir/${"n".repeat(90)}.txt`, new Uint8Array([0, 1])),
            ).rejects.toMatchObject({
                params: { detail: TABLE_COPY.notTextFile("n".repeat(80)) },
            })
        })

        it("reads a word file and a pdf, and refuses a file that is not one", async () => {
            const { client } = await build()
            const cause = new Error("locked")

            await expect(client.readDocumentFile("notes.docx", docx)).resolves.toEqual({ text: "word" })
            await expect(client.readDocumentFile("notes.docx", csv("no"))).rejects.toMatchObject({
                params: { detail: TABLE_COPY.badDocx("notes.docx") },
            })
            mockWord.error = cause
            await expect(client.readDocumentFile("notes.docx", docx)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.unreadableWord("notes.docx") },
                cause,
            })

            const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
            await expect(client.readDocumentFile("notes.pdf", pdf)).resolves.toEqual({ text: "pdf", pages: 2 })
            await expect(client.readDocumentFile("notes.pdf", csv("no"))).rejects.toMatchObject({
                params: { detail: TABLE_COPY.badPdf("notes.pdf") },
            })
            mockPdf.error = cause
            await expect(client.readDocumentFile("notes.pdf", pdf)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.unreadablePdf("notes.pdf") },
                cause,
            })
        })
    })

    describe("google links", () => {
        const sheet = "https://docs.google.com/spreadsheets/d/sheet-id-01/edit"
        const doc = "https://docs.google.com/document/d/doc-id-0001/edit"

        it("reads a public sheet and document", async () => {
            const { client, publicHost } = await build()
            publicHost.get.mockResolvedValue(google({}))

            await expect(client.readSheetLink(sheet)).resolves.toMatchObject({ headers: ["Name"], rows: [["An"]] })
            publicHost.get.mockResolvedValue(google({ headers: {}, text: "Hello" }))
            await expect(client.readDocumentLink(doc)).resolves.toEqual({ id: "doc-id-0001", text: "Hello" })
            expect(publicHost.get).toHaveBeenCalledWith(
                "https://docs.google.com/spreadsheets/d/sheet-id-01/export?format=csv&gid=0",
                { timeoutMs: 20_000, maxBytes: TABLE_MAX_BYTES, headers: { accept: "text/csv,text/plain;q=0.9" } },
            )
        })

        it("refuses a private page, a failed download and an answer that is too large", async () => {
            const { client, publicHost } = await build()
            publicHost.get.mockResolvedValue(
                google({ status: 200, headers: { "content-type": "text/html" }, text: "<html>" }),
            )
            await expect(client.readSheetLink(sheet)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.googleNotPublic },
            })

            publicHost.get.mockResolvedValue(google({ status: 500, text: "no" }))
            await expect(client.readSheetLink(sheet)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.googleNoData },
            })

            const cause = new Error("down")
            publicHost.get.mockRejectedValue(cause)
            await expect(client.readDocumentLink(doc)).rejects.toMatchObject({
                code: DataSourcesErrorCode.Unavailable,
                params: { detail: TABLE_COPY.googleUnreachable },
                cause,
            })

            const tooLarge = new DataSourcesError({ code: DataSourcesErrorCode.TooLarge, params: { limit: "10 MB" } })
            publicHost.get.mockRejectedValue(tooLarge)
            await expect(client.readDocumentLink(doc)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.googleTooLarge },
                cause: tooLarge,
            })
        })
    })
})
