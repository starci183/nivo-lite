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

describe("cellText and cleanHeaders", () => {
    it("turns a cell into trimmed text", () => {
        const midnight = new Date("2026-01-02T00:00:00.000Z")
        const instant = new Date("2026-01-02T03:04:05.000Z")

        expect(cellText(null)).toBe("")
        expect(cellText(undefined)).toBe("")
        expect(cellText(midnight)).toBe("2026-01-02")
        expect(cellText(instant)).toBe("2026-01-02T03:04:05.000Z")
        expect(cellText(new Date(Number.NaN))).toBe("")
        expect(cellText(1.5)).toBe("1.5")
        expect(cellText(Number.POSITIVE_INFINITY)).toBe("")
        expect(cellText("  hello  ")).toBe("hello")
        expect(cellText("x".repeat(TABLE_CELL_MAX + 5))).toHaveLength(TABLE_CELL_MAX)
        expect(cellText(true)).toBe("true")
        expect(cellText(false)).toBe("false")
        expect(cellText({ n: 1 })).toBe("")
    })

    it("names an empty header and numbers a repeated one", () => {
        expect(cleanHeaders(["", "Name", "Name", "x".repeat(130)])).toEqual([
            TABLE_COPY.columnName(1),
            "Name",
            "Name (2)",
            "x".repeat(120),
        ])
    })
})

describe("tableFromRows and tableFromGrid", () => {
    it("uses the first filled row as headers and drops empty rows", () => {
        expect(
            tableFromRows([["", ""], ["Name", "Qty", ""], ["", "", ""], ["An"]], {
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

    it("refuses a sheet with no data, an empty header, or too many columns or rows", () => {
        expect(() => tableFromRows([["", ""]], { delimiter: "", sheets: [], sheet: "" })).toThrow(
            expect.objectContaining({ params: { detail: TABLE_COPY.noData } }),
        )
        expect(() => tableFromRows([[]], { delimiter: "", sheets: [], sheet: "" })).toThrow(
            expect.objectContaining({ params: { detail: TABLE_COPY.noData } }),
        )
        const wide = [Array.from({ length: TABLE_MAX_COLUMNS + 1 }, (_item, index) => `c${index}`)]
        expect(() => tableFromRows(wide, { delimiter: "", sheets: [], sheet: "" })).toThrow(
            expect.objectContaining({ params: { detail: TABLE_COPY.tooManyColumns(TABLE_MAX_COLUMNS) } }),
        )
        const rows = Array.from({ length: TABLE_MAX_ROWS + 1 }, () => ["a"])
        expect(() => tableFromRows([["Name"], ...rows], { delimiter: "", sheets: [], sheet: "" })).toThrow(
            expect.objectContaining({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TABLE_COPY.tooManyRows("20.000") },
            }),
        )
    })

    it("reads a typed grid as a table with no delimiter", () => {
        expect(tableFromGrid(["Name"], [["An"]])).toEqual({
            headers: ["Name"],
            rows: [["An"]],
            delimiter: "",
            sheets: [],
            sheet: "",
        })
    })
})

describe("text, zip and file kind", () => {
    it("drops a byte order mark and decodes UTF-8 and UTF-16", () => {
        expect(withoutBom("\uFEFFhello")).toBe("hello")
        expect(withoutBom("hello")).toBe("hello")
        expect(decodeText(new Uint8Array([0x68, 0x69]))).toBe("hi")
        expect(decodeText(new Uint8Array([0xff, 0xfe, 0x68, 0x00]))).toBe("h")
        expect(decodeText(new Uint8Array([0xfe, 0xff, 0x00, 0x68]))).toBe("h")
    })

    it("recognises a zip, a binary file, and the table and document extensions", () => {
        const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
        const text = new Uint8Array([0x68, 0x69])
        const binary = new Uint8Array([0x00, 0x01])

        expect(isZip(zip)).toBe(true)
        expect(isZip(text)).toBe(false)
        expect(isZip(new Uint8Array([0x50, 0x00, 0x03, 0x04]))).toBe(false)
        expect(isZip(new Uint8Array([0x50, 0x4b, 0x00, 0x04]))).toBe(false)
        expect(isZip(new Uint8Array([0x50, 0x4b, 0x03, 0x00]))).toBe(false)
        expect(looksBinary(binary)).toBe(true)
        expect(looksBinary(new Uint8Array([0xff, 0x00]))).toBe(false)
        expect(looksBinary(new Uint8Array([0xfe, 0x00]))).toBe(false)
        expect(looksBinary(text)).toBe(false)
        expect(tableFileKind("Orders.CSV")).toBe("csv")
        expect(tableFileKind("orders.tsv")).toBe("csv")
        expect(tableFileKind("orders.txt")).toBe("csv")
        expect(tableFileKind("orders.XLSX")).toBe("xlsx")
        expect(tableFileKind("orders.xls")).toBeNull()
        expect(tableFileKind("orders")).toBeNull()
        expect(documentKind("notes.DOCX")).toBe("docx")
        expect(documentKind("notes.pdf")).toBe("pdf")
        expect(documentKind("notes.txt")).toBe("text")
        expect(documentKind("notes.md")).toBe("text")
        expect(documentKind("notes.csv")).toBeNull()
    })

    it("refuses an empty file and one over ten megabytes", () => {
        const cause = new Error("no")
        expect(rejected("nope", cause)).toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: "nope" },
            cause,
        })
        expect(() => assertFileSize(new Uint8Array())).toThrow(
            expect.objectContaining({ params: { detail: TABLE_COPY.fileEmpty } }),
        )
        expect(() => assertFileSize(new Uint8Array(TABLE_MAX_BYTES + 1))).toThrow(
            expect.objectContaining({ params: { detail: TABLE_COPY.fileTooLarge } }),
        )
        expect(() => assertFileSize(new Uint8Array([1]))).not.toThrow()
    })
})
