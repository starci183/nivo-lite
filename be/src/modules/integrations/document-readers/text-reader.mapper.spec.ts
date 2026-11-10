import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DocumentWarningCode, MAX_TABLE_ROWS } from "./document-readers.contracts"
import { decodeText, delimitedRows, looksBinary, sectionsOf, tableOf, tableText } from "./text-reader.mapper"

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

describe("text reader mapper", () => {
    it("decodes UTF-16 with its mark and UTF-8 without its mark, one newline style", () => {
        expect(decodeText(fixture("notes.txt"))).toBe("Ghi chú: mở cửa 7 giờ.\nNghỉ Tết từ 28 đến mùng 4.")
        expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x0d, 0x0a, 0x42]))).toBe("A\nB")
        expect(decodeText(new Uint8Array([0xfe, 0xff, 0x00, 0x41]))).toBe("A")
    })

    it("tells a binary body from text", () => {
        expect(looksBinary(new Uint8Array([0x41, 0x00, 0x42]))).toBe(true)
        expect(looksBinary(fixture("notes.txt"))).toBe(false)
        expect(looksBinary(fixture("policy.md"))).toBe(false)
    })

    it("cuts Markdown into its headings and the text under each", () => {
        expect(sectionsOf(decodeText(fixture("policy.md")))).toEqual([
            { heading: "Chính sách đổi trả", text: "Đổi hoa trong 2 giờ nếu hoa héo." },
            { heading: "Hoàn tiền", text: "Hoàn 100% khi giao trễ quá 1 giờ." },
        ])
        expect(sectionsOf("no heading\nat all")).toEqual([])
        expect(sectionsOf("Intro\n# Title\nBody")).toEqual([
            { heading: null, text: "Intro" },
            { heading: "Title", text: "Body" },
        ])
    })

    it("parses delimited rows with quoted delimiters, doubled quotes and line breaks inside quotes", () => {
        expect(delimitedRows(decodeText(fixture("prices.csv")), ";")).toEqual([
            ["Món", "Giá", "Ghi chú"],
            ["Bó hồng đỏ", "350.000", 'Có "thiệp"; giao nhanh'],
            ["Lẵng hướng dương", "520.000", ""],
            ["", "", ""],
            ["Hoa cưới", "1.200.000", "đặt trước"],
        ])
        expect(delimitedRows('a,"x\ny"\nb,c', ",")).toEqual([
            ["a", "x\ny"],
            ["b", "c"],
        ])
    })

    it("makes a table of the filled rows, header first, a pipe in a cell kept out of the cell separator", () => {
        const made = tableOf("Bảng", delimitedRows(decodeText(fixture("prices.tsv")), "\t"))
        expect(made.warnings).toEqual([])
        expect(made.table).toEqual({
            name: "Bảng",
            header: ["Món", "Giá"],
            rows: [
                ["Bó cúc/trắng", "150.000"],
                ["Hoa lan", "800.000"],
            ],
        })
        expect(tableText(made.table ?? { name: null, header: [], rows: [] })).toBe(
            "Món | Giá\nBó cúc/trắng | 150.000\nHoa lan | 800.000",
        )
        expect(tableOf(null, [["", " "], []]).table).toBeNull()
    })

    it("keeps at most the row limit and says how many rows were read", () => {
        const rows = [["h"], ...Array.from({ length: MAX_TABLE_ROWS + 3 }, (_, index) => [String(index)])]
        const made = tableOf("S", rows)
        expect(made.table?.rows).toHaveLength(MAX_TABLE_ROWS)
        expect(made.warnings).toEqual([{ code: DocumentWarningCode.RowsOverLimit, place: "S", count: MAX_TABLE_ROWS }])
    })
})
