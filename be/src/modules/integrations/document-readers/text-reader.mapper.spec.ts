import { Test } from "@nestjs/testing"
import {
    NOTES_DECODED_VI,
    NOTES_FILE_VI,
    POLICY_FILE_VI,
    POLICY_REFUND_HEADING_VI,
    POLICY_REFUND_TEXT_VI,
    POLICY_RETURNS_HEADING_VI,
    POLICY_RETURNS_TEXT_VI,
    PRICES_CSV_ROWS_VI,
    PRICES_CSV_VI,
    PRICES_TSV_VI,
    TABLE_HEADER_VI,
    TABLE_NAME_VI,
    TABLE_ROW_CUC_VI,
    TABLE_ROW_LAN_VI,
    TABLE_TEXT_VI,
} from "@tests/fixtures/i18n/document-readers-spec.messages"
import { DocumentWarningCode, MAX_TABLE_ROWS } from "./document-readers.contracts"
import { decodeText, delimitedRows, looksBinary, sectionsOf, tableOf, tableText } from "./text-reader.mapper"

const SUBJECT = Symbol("text-reader.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { decodeText, delimitedRows, looksBinary, sectionsOf, tableOf, tableText } }],
    }).compile()
    return moduleRef.get<typeof import("./text-reader.mapper")>(SUBJECT)
}

/** The bytes of a UTF-16 little-endian file that starts with its byte order mark. */
const utf16File = (text: string): Uint8Array => new Uint8Array(Buffer.from(`\uFEFF${text}`, "utf16le"))

/** The bytes of a UTF-8 file without a byte order mark. */
const utf8File = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, "utf8"))

describe("text reader mapper", () => {
    it("decodes UTF-16 with its mark and UTF-8 without its mark, one newline style", async () => {
        const subject = await build()

        expect(subject.decodeText(utf16File(NOTES_FILE_VI))).toBe(NOTES_DECODED_VI)
        expect(subject.decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x0d, 0x0a, 0x42]))).toBe("A\nB")
        expect(subject.decodeText(new Uint8Array([0xfe, 0xff, 0x00, 0x41]))).toBe("A")
    })

    it("tells a binary body from text", async () => {
        const subject = await build()

        expect(subject.looksBinary(new Uint8Array([0x41, 0x00, 0x42]))).toBe(true)
        expect(subject.looksBinary(utf16File(NOTES_FILE_VI))).toBe(false)
        expect(subject.looksBinary(utf8File(POLICY_FILE_VI))).toBe(false)
    })

    it("cuts Markdown into its headings and the text under each", async () => {
        const subject = await build()

        expect(subject.sectionsOf(subject.decodeText(utf8File(POLICY_FILE_VI)))).toEqual([
            { heading: POLICY_RETURNS_HEADING_VI, text: POLICY_RETURNS_TEXT_VI },
            { heading: POLICY_REFUND_HEADING_VI, text: POLICY_REFUND_TEXT_VI },
        ])
        expect(subject.sectionsOf("no heading\nat all")).toEqual([])
        expect(subject.sectionsOf("Intro\n# Title\nBody")).toEqual([
            { heading: null, text: "Intro" },
            { heading: "Title", text: "Body" },
        ])
    })

    it("parses delimited rows with quoted delimiters, doubled quotes and line breaks inside quotes", async () => {
        const subject = await build()

        expect(subject.delimitedRows(subject.decodeText(utf8File(PRICES_CSV_VI)), ";")).toEqual(PRICES_CSV_ROWS_VI)
        expect(subject.delimitedRows('a,"x\ny"\nb,c', ",")).toEqual([
            ["a", "x\ny"],
            ["b", "c"],
        ])
    })

    it("makes a table of the filled rows, header first, a pipe in a cell kept out of the cell separator", async () => {
        const subject = await build()

        const made = subject.tableOf(TABLE_NAME_VI, subject.delimitedRows(subject.decodeText(utf8File(PRICES_TSV_VI)), "\t"))
        expect(made.warnings).toEqual([])
        expect(made.table).toEqual({
            name: TABLE_NAME_VI,
            header: TABLE_HEADER_VI,
            rows: [TABLE_ROW_CUC_VI, TABLE_ROW_LAN_VI],
        })
        expect(subject.tableText(made.table ?? { name: null, header: [], rows: [] })).toBe(TABLE_TEXT_VI)
        expect(subject.tableOf(null, [["", " "], []]).table).toBeNull()
    })

    it("keeps at most the row limit and says how many rows were read", async () => {
        const subject = await build()

        const rows = [["h"], ...Array.from({ length: MAX_TABLE_ROWS + 3 }, (_, index) => [String(index)])]
        const made = subject.tableOf("S", rows)
        expect(made.table?.rows).toHaveLength(MAX_TABLE_ROWS)
        expect(made.warnings).toEqual([{ code: DocumentWarningCode.RowsOverLimit, place: "S", count: MAX_TABLE_ROWS, left: 3 }])
    })
})
