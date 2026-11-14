import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { strToU8, zipSync } from "fflate"
import { DocumentWarningCode } from "./document-readers.contracts"
import { DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"
import { presentationText as presentationTextSubject, workbookText as workbookTextSubject } from "./office-reader.mapper"

const SUBJECT = Symbol("office-reader.mapper")

describe("office-reader.mapper built the way Nest does", () => {
    let presentationText: typeof presentationTextSubject
    let workbookText: typeof workbookTextSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ presentationText: typeof presentationTextSubject; workbookText: typeof workbookTextSubject }>({ presentationText: presentationTextSubject, workbookText: workbookTextSubject }) }],
        }).compile()
        ;({ presentationText, workbookText } = moduleRef.get<{ presentationText: typeof presentationTextSubject; workbookText: typeof workbookTextSubject }>(SUBJECT))
    })

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

describe("office reader mapper", () => {
    it("reads each sheet as a table: its name a heading, a blank line, the header row first, dates written out", () => {
        const read = workbookText(fixture("price-list.xlsx"))
        expect(read.sheetCount).toBe(3)
        expect(read.pages.map((page) => [page.kind, page.label])).toEqual([
            ["sheet", "B\u1EA3ng gi\u00E1"],
            ["sheet", "Ghi ch\u00FA"],
        ])
        const [prices, notes] = read.pages
        expect(prices?.text.split("\n").slice(0, 4)).toEqual([
            "## B\u1EA3ng gi\u00E1",
            "",
            "M\u1EABu hoa | Gi\u00E1 (\u0111\u1ED3ng) | \u0110\u01A1n v\u1ECB | \u00C1p d\u1EE5ng t\u1EEB",
            "B\u00F3 hoa m\u1EABu s\u1ED1 1 h\u1ED3ng \u0111\u1ECF | 105000 | b\u00F3 | 01/11/2026",
        ])
        expect(notes?.text).toBe(
            "## Ghi ch\u00FA\n\nGhi ch\u00FA\nGiao h\u00E0ng mi\u1EC5n ph\u00ED trong n\u1ED9i th\u00E0nh cho \u0111\u01A1n t\u1EEB 500.000 \u0111\u1ED3ng.\n\u0110\u1EB7t tr\u01B0\u1EDBc 1 ng\u00E0y v\u1EDBi hoa c\u01B0\u1EDBi.",
        )
        expect(read.tables[0]?.rows).toHaveLength(40)
        expect(read.warnings).toEqual([{ code: DocumentWarningCode.PlaceEmpty, place: "Tr\u1ED1ng", count: null }])
    })

    it("places inline strings, booleans and gaps in their columns, and never reads a shared string for an empty cell", () => {
        const sheet =
            '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>M\u00F3n</t></is></c><c r="C1" t="inlineStr"><is><t>C\u00F2n</t></is></c></row>' +
            '<row r="2"><c r="A2" t="s"/><c r="B2" t="str"><v>x &amp; y</v></c><c r="C2" t="b"><v>1</v></c></row></sheetData></worksheet>'
        const bytes = zipSync({
            "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="S" r:id="rId9"/></sheets></workbook>'),
            "xl/worksheets/sheet1.xml": strToU8(sheet),
        })
        const read = workbookText(bytes)
        expect(read.tables[0]).toEqual({ name: "S", header: ["M\u00F3n", "", "C\u00F2n"], rows: [["", "x & y", "TRUE"]] })
    })

    it("refuses an archive that is no workbook or no presentation", () => {
        const other = zipSync({ "word/document.xml": strToU8("<w:document/>") })
        expect(() => workbookText(other)).toThrow(DocumentReadersError)
        expect(() => workbookText(other)).toThrow(DocumentReadersErrorCode.NotWorkbook)
        expect(() => presentationText(other)).toThrow(DocumentReadersError)
        expect(() => presentationText(other)).toThrow(DocumentReadersErrorCode.NotPresentation)
    })

    it("reads the slides in their number order, one line per paragraph, an empty slide named in a warning", () => {
        const read = presentationText(fixture("slides.pptx"))
        expect(read.pages).toEqual([
            { kind: "slide", label: "1", text: "Khuy\u1EBFn m\u00E3i th\u00E1ng 11\nGi\u1EA3m 10% cho hoa sinh nh\u1EADt", transcribed: false },
            { kind: "slide", label: "2", text: "", transcribed: false },
            { kind: "slide", label: "3", text: "Li\u00EAn h\u1EC7: 0901 234 567", transcribed: false },
        ])
        expect(read.warnings).toEqual([{ code: DocumentWarningCode.PlaceEmpty, place: "2", count: null }])
    })
})
})
