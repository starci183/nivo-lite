import { Test } from "@nestjs/testing"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { TABLE_COPY } from "./messages/table.messages"
import { TABLE_CELL_MAX, TABLE_MAX_BYTES, TABLE_MAX_COLUMNS, TABLE_MAX_ROWS } from "./table-shapes.contracts"
import {
    assertFileSize,
    cellText,
    cleanHeaders,
    decodeText,
    documentKind,
    isZip,
    looksBinary,
    rejected,
    tableFileKind,
    tableFromGrid,
    tableFromRows,
    withoutBom,
} from "./table-rows.policy"

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

const SUBJECT = Symbol("table-rows.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    rejected,
                    cellText,
                    cleanHeaders,
                    tableFromRows,
                    tableFromGrid,
                    withoutBom,
                    decodeText,
                    isZip,
                    looksBinary,
                    tableFileKind,
                    documentKind,
                    assertFileSize,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./table-rows.policy")>(SUBJECT)
}

describe("cellText and cleanHeaders", () => {
    it("turns a cell into trimmed text", async () => {
        const subject = await buildSubject()

        const midnight = new Date("2026-01-02T00:00:00.000Z")
        const instant = new Date("2026-01-02T03:04:05.000Z")

        expect(subject.cellText(null)).toBe("")
        expect(subject.cellText(undefined)).toBe("")
        expect(subject.cellText(midnight)).toBe("2026-01-02")
        expect(subject.cellText(instant)).toBe("2026-01-02T03:04:05.000Z")
        expect(subject.cellText(new Date(Number.NaN))).toBe("")
        expect(subject.cellText(1.5)).toBe("1.5")
        expect(subject.cellText(Number.POSITIVE_INFINITY)).toBe("")
        expect(subject.cellText("  hello  ")).toBe("hello")
        expect(subject.cellText("x".repeat(TABLE_CELL_MAX + 5))).toHaveLength(TABLE_CELL_MAX)
        expect(subject.cellText(true)).toBe("true")
        expect(subject.cellText(false)).toBe("false")
        expect(subject.cellText({ n: 1 })).toBe("")
    })

    it("names an empty header and numbers a repeated one", async () => {
        const subject = await buildSubject()

        expect(subject.cleanHeaders(["", "Name", "Name", "x".repeat(130)])).toEqual([
            TABLE_COPY.columnName(1),
            "Name",
            "Name (2)",
            "x".repeat(120),
        ])
    })
})

describe("tableFromRows and tableFromGrid", () => {
    it("uses the first filled row as headers and drops empty rows", async () => {
        const subject = await buildSubject()

        expect(
            subject.tableFromRows([["", ""], ["Name", "Qty", ""], ["", "", ""], ["An"]], {
                delimiter: ",",
                sheets: ["Orders"],
                sheet: "Orders",
            }),
        ).toEqual({
            headers: ["Name", "Qty"],
            rows: [["An", ""]],
            delimiter: ",",
            sheets: ["Orders"],
            sheet: "Orders",
        })
    })

    it("keeps a leading blank header while trimming only blanks after the last named column", async () => {
        const subject = await buildSubject()

        expect(
            subject.tableFromRows(
                [
                    ["", "Name", "", ""],
                    ["1", "An"],
                ],
                {
                    delimiter: ",",
                    sheets: [],
                    sheet: "",
                },
            ),
        ).toEqual({
            headers: [TABLE_COPY.columnName(1), "Name"],
            rows: [["1", "An"]],
            delimiter: ",",
            sheets: [],
            sheet: "",
        })
    })

    it("refuses a sheet with no data, an empty header, or too many columns or rows", async () => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.tableFromRows([["", ""]], { delimiter: "", sheets: [], sheet: "" }))).toEqual(
            objectLike({ params: { detail: TABLE_COPY.noData } }),
        )
        expect(thrownBy(() => subject.tableFromRows([[]], { delimiter: "", sheets: [], sheet: "" }))).toEqual(
            objectLike({ params: { detail: TABLE_COPY.noData } }),
        )
        const wide = [Array.from({ length: TABLE_MAX_COLUMNS + 1 }, (_item, index) => `c${index}`)]
        expect(thrownBy(() => subject.tableFromRows(wide, { delimiter: "", sheets: [], sheet: "" }))).toEqual(
            objectLike({ params: { detail: TABLE_COPY.tooManyColumns(TABLE_MAX_COLUMNS) } }),
        )
        const rows = Array.from({ length: TABLE_MAX_ROWS + 1 }, () => ["a"])
        expect(
            thrownBy(() => subject.tableFromRows([["Name"], ...rows], { delimiter: "", sheets: [], sheet: "" })),
        ).toEqual(
            objectLike({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TABLE_COPY.tooManyRows("20.000") },
            }),
        )
    })

    it("reads a typed grid as a table with no delimiter", async () => {
        const subject = await buildSubject()

        expect(subject.tableFromGrid(["Name"], [["An"]])).toEqual({
            headers: ["Name"],
            rows: [["An"]],
            delimiter: "",
            sheets: [],
            sheet: "",
        })
    })
})

describe("text, zip and file kind", () => {
    it("drops a byte order mark and decodes UTF-8 and UTF-16", async () => {
        const subject = await buildSubject()

        expect(subject.withoutBom("\uFEFFhello")).toBe("hello")
        expect(subject.withoutBom("hello")).toBe("hello")
        expect(subject.decodeText(new Uint8Array([0x68, 0x69]))).toBe("hi")
        expect(subject.decodeText(new Uint8Array([0xff, 0xfe, 0x68, 0x00]))).toBe("h")
        expect(subject.decodeText(new Uint8Array([0xfe, 0xff, 0x00, 0x68]))).toBe("h")
    })

    it("recognises a zip, a binary file, and the table and document extensions", async () => {
        const subject = await buildSubject()

        const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
        const text = new Uint8Array([0x68, 0x69])
        const binary = new Uint8Array([0x00, 0x01])

        expect(subject.isZip(zip)).toBe(true)
        expect(subject.isZip(text)).toBe(false)
        expect(subject.isZip(new Uint8Array([0x50, 0x00, 0x03, 0x04]))).toBe(false)
        expect(subject.isZip(new Uint8Array([0x50, 0x4b, 0x00, 0x04]))).toBe(false)
        expect(subject.isZip(new Uint8Array([0x50, 0x4b, 0x03, 0x00]))).toBe(false)
        expect(subject.looksBinary(binary)).toBe(true)
        expect(subject.looksBinary(new Uint8Array([0xff, 0x00]))).toBe(false)
        expect(subject.looksBinary(new Uint8Array([0xfe, 0x00]))).toBe(false)
        expect(subject.looksBinary(text)).toBe(false)
        expect(subject.tableFileKind("Orders.CSV")).toBe("csv")
        expect(subject.tableFileKind("orders.tsv")).toBe("csv")
        expect(subject.tableFileKind("orders.txt")).toBe("csv")
        expect(subject.tableFileKind("orders.XLSX")).toBe("xlsx")
        expect(subject.tableFileKind("orders.xls")).toBeNull()
        expect(subject.tableFileKind("orders")).toBeNull()
        expect(subject.documentKind("notes.DOCX")).toBe("docx")
        expect(subject.documentKind("notes.pdf")).toBe("pdf")
        expect(subject.documentKind("notes.txt")).toBe("text")
        expect(subject.documentKind("notes.md")).toBe("text")
        expect(subject.documentKind("notes.csv")).toBeNull()
    })

    it("refuses an empty file and one over ten megabytes", async () => {
        const subject = await buildSubject()

        const cause = new Error("no")
        expect(subject.rejected("nope", cause)).toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: "nope" },
            cause,
        })
        expect(thrownBy(() => subject.assertFileSize(new Uint8Array()))).toEqual(
            objectLike({ params: { detail: TABLE_COPY.fileEmpty } }),
        )
        expect(thrownBy(() => subject.assertFileSize(new Uint8Array(TABLE_MAX_BYTES + 1)))).toEqual(
            objectLike({ params: { detail: TABLE_COPY.fileTooLarge } }),
        )
        expect(() => subject.assertFileSize(new Uint8Array([1]))).not.toThrow()
    })
})
