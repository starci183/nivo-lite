import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import mammoth from "mammoth"
import Papa from "papaparse"
import unpdf from "unpdf"
import { PUBLIC_HOST, WORKBOOK_READER } from "./data-sources.decorators"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { TABLE_COPY } from "./messages/table.messages"
import { TABLE_MAX_BYTES } from "./table-shapes.contracts"
import { TableClient } from "./table.client"
import type { PublicHostClient, PublicResponse } from "./public-host.client"
import { WorkbookReaderClient } from "./workbook-reader.client"
import type { WorkbookReader } from "./workbook-reader.contracts"

interface TextParser {
    parse(text: string, config: Papa.ParseConfig<Array<string>>): Papa.ParseResult<Array<string>>
}

const textParser: TextParser = Papa

class MockWord {
    text = "word"
    error: Error | undefined = undefined
}
class MockPdf {
    text = "pdf"
    pages = 2
    error: Error | undefined = undefined
}
const mockWord = new MockWord()
const mockPdf = new MockPdf()

const wordSpy = jest.spyOn(mammoth, "extractRawText")
const proxySpy = jest.spyOn(unpdf, "getDocumentProxy")
const pdfSpy = jest.spyOn(unpdf, "extractText")

/** A real workbook of two sheets, First (Name / An) and Second (Name / Bo), as the bytes of an .xlsx file. */
const TWO_SHEETS = Buffer.from(
    [
        "UEsDBBQAAAAIABGnTV3xqbA++gAAAKQCAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLWSsU7DMBCGX8XyWsVOOyCEknYoMAJDeQDj",
        "XBIr9p3lc0N4e5S0YkAFhATTDfff/33DVbspeDFCYkdYy7UqpQC01Djsavl8uC+u5W5bHd4isJiCR65ln3O80ZptD8Gwogg4Bd9S",
        "CiazotTpaOxgOtCbsrzSljAD5iLPHXJb3UJrjj6LuykDnrAJPEuxPwVnVi1NjN5Zkx2hHrH5RCnOBJXALxnuXeTVFLzUFwnz5mvA",
        "+e5xhJRcA+LJpPxgAtRST16/UhpeiAb1fckFS2pbZ6EhewyAWXFMYBruAXLwapkqGIern/k8h1kvY/3HIh/9v/TY/LeHXt5u+w5Q",
        "SwMEFAAAAAgAEadNXRxJ976kAAAAFgEAAAsAAABfcmVscy8ucmVsc43PsQ7CIBSF4VchdxeqgzGmtIsx6WrqAyC9bUmBSwAV397V",
        "Ggf3k+/kr9viLHtgTIa8hC2vgKHXNBg/Sbj2580B2qa+oFXZkE+zCYkVZ32SMOccjkIkPaNTiVNAX5wdKTqVE6c4iaD0oiYUu6ra",
        "i/hpwNpk3SAhdsMWWP8K+I9N42g0nkjfHfr84+JrAaxXccIsoVjxpLjciBZenAXR1GIV2LwBUEsDBBQAAAAIABGnTV2JactYvgAA",
        "ADcBAAAPAAAAeGwvd29ya2Jvb2sueG1sjZDBasMwEER/Rey9lu1DKcZyLiWQc9MPUKV1LCLtml019eeXJg2kt54GhscbmHG3lWwu",
        "KJqYHHRNCwYpcEx0cvB+3D+9wG4av1jOH8xns5VM6mCpdR2s1bBg8drwirSVPLMUX7VhOVldBX3UBbGWbPu2fbbFJ4KbYZD/OHie",
        "U8BXDp8Fqd4kgtnXxKRLWhWm8bqgv2nIF3SwT6IVzLU6RAcdGBlSdCCH2IH9C79hYIoPdP9A9z+0vW/Y+w3TN1BLAwQUAAAACAAR",
        "p01dims7GrMAAACkAQAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzvZDBqsIwEEV/JczeTtuFyMPoRgS3Uj8gpNM2mGRC",
        "Jmr9e0Hw8QQXb+Xqwl2ce7jr7Ry8ulIWx1FDU9WgKFruXRw1nLr9YgXbzfpI3hTHUSaXRM3BR9EwlZJ+EMVOFIxUnCjOwQ+cgylS",
        "cR4xGXs2I2Fb10vMfxnwzlSHXkM+9A2o7p7oP2weBmdpx/YSKJYPE3jjfJaJqIDqTB6paPitBJ/RVHPwgJ9l2i/LtC8ZfLt78wBQ",
        "SwMEFAAAAAgAEadNXQ6ZTryyAAAAFgEAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWx1j81qw0AMhF9l0b2W7UMoRasQCD32",
        "0vYBFkeNl+6P0YrYj1+Sg+mhvc0MzMcMHbec3E20xVo8DF0PTspUL7FcPXx+vD49w5FprfrdZhFzW06leZjNlhfENs2SQ+vqImXL",
        "6atqDta6qldsi0q4PEo54dj3B8whFmB6ZOdggUnr6tTDAEzTXZwGcOYhlhSLvJsCU2xMxm8hC6Ex4d3jxIRa1x0w7oDxH8Cp/FXH",
        "X1twP8k/UEsDBBQAAAAIABGnTV35362pswAAABYBAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sdY/BasMwEER/Rey9XtuH",
        "UMpqQ0vpsZe2HyCcbSwiaY20xP78khxMD+1tZmAeM3TccnJXqS1q8TB0PTgpk55iOXv4+nx7eIQj06r10mYRc1tOpXmYzZYnxDbN",
        "kkPrdJGy5fStNQdrndYztqVKON1LOeHY9wfMIRZgumevwQJT1dVVDwMwTTfxPIAzD7GkWOTDKjDFxmT8HrIQGhPePE5MWHXdAeMO",
        "GP8BvOhfdfy1BfeT/ANQSwECFAAUAAAACAARp01d8amwPvoAAACkAgAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNd",
        "LnhtbFBLAQIUABQAAAAIABGnTV0cSfe+pAAAABYBAAALAAAAAAAAAAAAAACAASsBAABfcmVscy8ucmVsc1BLAQIUABQAAAAIABGn",
        "TV2JactYvgAAADcBAAAPAAAAAAAAAAAAAACAAfgBAAB4bC93b3JrYm9vay54bWxQSwECFAAUAAAACAARp01dims7GrMAAACkAQAA",
        "GgAAAAAAAAAAAAAAgAHjAgAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwECFAAUAAAACAARp01dDplOvLIAAAAWAQAAGAAA",
        "AAAAAAAAAAAAgAHOAwAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsBAhQAFAAAAAgAEadNXfnframzAAAAFgEAABgAAAAAAAAA",
        "AAAAAIABtgQAAHhsL3dvcmtzaGVldHMvc2hlZXQyLnhtbFBLBQYAAAAABgAGAIsBAACfBQAAAAA=",
    ].join(""),
    "base64",
)

/** A ZIP workbook with an empty sheets list and its workbook relationships. */
const NO_SHEETS = Buffer.from(
    [
        "UEsDBBQAAAAIAJGITl2FoDfkVAAAAGAAAAAPAAAAeGwvd29ya2Jvb2sueG1sNYxBCoAgEAC/Ej2glQ4dwvyL1Zah64q7UM9Pgo4z",
        "A2NvrnFljt1DKcvSB9UyA8gWkLwMXDC3cnAlrw3rCVIq+l0ColKC0ZgJyF+5d/ZzAs7Cf3UvUEsDBBQAAAAIAJGITl013cuD",
        "SwAAAFUAAAAaAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHOzCUrNSSzJzM8rzsgsKFaoyM3JK7ZVyigpKbDS1y9OzkjN",
        "TSzWyy9IzQPKpOUX5SaWALlF6foFicnZiemp+kYGBmb6RchmKOnbAQBQSwECFAAUAAAACACRiE5dhaA35FQAAABgAAAADwAA",
        "AAAAAAAAAAAAAAAAAAAAeGwvd29ya2Jvb2sueG1sUEsBAhQAFAAAAAgAkYhOXTXdy4NLAAAAVQAAABoAAAAAAAAAAAAAAAAAgQAA",
        "AHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsFBgAAAAACAAIAhQAAAAQBAAAAAA==",
    ].join(""),
    "base64",
)

const csv = (text: string): Uint8Array => new TextEncoder().encode(text)
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])
const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04])

const build = async () => {
    const publicHost = mock<PublicHostClient>()
    const workbookReader = mock<WorkbookReader>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TableClient,
            WorkbookReaderClient,
            { provide: PUBLIC_HOST, useValue: publicHost },
            { provide: WORKBOOK_READER, useValue: workbookReader },
        ],
    }).compile()
    workbookReader.read.mockImplementation((bytes) => moduleRef.get(WorkbookReaderClient).read(bytes))
    return { client: moduleRef.get(TableClient), publicHost, workbookReader }
}

const google = (partial: Partial<PublicResponse>): PublicResponse => ({
    status: 200,
    headers: { "content-type": "text/csv" },
    text: "Name\nAn",
    ...partial,
})

describe("TableClient", () => {
    beforeEach(() => {
        wordSpy.mockImplementation(() =>
            mockWord.error === undefined
                ? Promise.resolve({ value: mockWord.text, messages: [] })
                : Promise.reject(mockWord.error),
        )
        proxySpy.mockResolvedValue(mock<Awaited<ReturnType<typeof unpdf.getDocumentProxy>>>())
        pdfSpy.mockImplementation(() =>
            mockPdf.error === undefined
                ? Promise.resolve({ text: mockPdf.text, totalPages: mockPdf.pages })
                : Promise.reject(mockPdf.error),
        )
        mockWord.text = "word"
        mockWord.error = undefined
        mockPdf.text = "pdf"
        mockPdf.pages = 2
        mockPdf.error = undefined
    })

    afterAll(() => {
        jest.restoreAllMocks()
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

        it("refuses unterminated quotes when the parser has no usable rows", async () => {
            const { client } = await build()

            expect(() => client.readText('"')).toThrow(
                expect.objectContaining({
                    code: DataSourcesErrorCode.Rejected,
                    params: { detail: TABLE_COPY.brokenQuotes },
                }),
            )
        })

        it("defaults to a comma when the parser reports an empty delimiter", async () => {
            const { client } = await build()
            const parsed: Papa.ParseResult<Array<string>> = {
                data: [["Name"], ["An"]],
                errors: [],
                meta: { delimiter: "", linebreak: "\n", aborted: false, truncated: false, cursor: 7 },
            }
            const parseSpy = jest.spyOn(textParser, "parse").mockReturnValueOnce(parsed)

            expect(client.readText("Name\nAn")).toEqual({
                headers: ["Name"],
                rows: [["An"]],
                delimiter: ",",
                sheets: [],
                sheet: "",
            })
            expect(parseSpy).toHaveBeenCalledWith("Name\nAn", {
                delimitersToGuess: [",", ";", "\t", "|"],
                skipEmptyLines: "greedy",
            })
            parseSpy.mockRestore()
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

        it("reads the named sheet, else the first, and refuses an unreadable workbook", async () => {
            const { client } = await build()

            await expect(client.readFile("orders.xlsx", TWO_SHEETS, "Second")).resolves.toMatchObject({
                headers: ["Name"],
                rows: [["Bo"]],
                sheets: ["First", "Second"],
                sheet: "Second",
            })
            await expect(client.readFile("orders.xlsx", TWO_SHEETS)).resolves.toMatchObject({
                sheet: "First",
                rows: [["An"]],
            })
            await expect(client.readFile("orders.xlsx", zip)).rejects.toMatchObject({
                params: { detail: TABLE_COPY.unreadableExcel },
            })
        })

        it("preserves the reader failure for a workbook with no sheets", async () => {
            const { client } = await build()
            const answer = client.readFile("empty.xlsx", NO_SHEETS)

            await expect(answer).rejects.toMatchObject({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TABLE_COPY.unreadableExcel },
                cause: expect.objectContaining({
                    name: "TypeError",
                    message: "readFiles(...).then is not a function",
                }),
            })
            await expect(answer).rejects.toHaveProperty("cause", expect.any(TypeError))
        })

        it("refuses a workbook when the reader returns no sheets", async () => {
            const { client, workbookReader } = await build()
            workbookReader.read.mockResolvedValue([])

            await expect(client.readFile("empty.xlsx", zip)).rejects.toMatchObject({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TABLE_COPY.noSheets },
            })
            expect(workbookReader.read).toHaveBeenCalledWith(zip)
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
