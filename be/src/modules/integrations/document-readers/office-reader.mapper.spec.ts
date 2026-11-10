import { readFileSync } from "node:fs"
import { join } from "node:path"
import { strToU8, zipSync } from "fflate"
import { DocumentWarningCode } from "./document-readers.contracts"
import { presentationText, workbookText } from "./office-reader.mapper"

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

describe("office reader mapper", () => {
    it("reads each sheet as a table: its name a heading, a blank line, the header row first, dates written out", () => {
        const read = workbookText(fixture("price-list.xlsx"))
        expect(read.sheetCount).toBe(3)
        expect(read.pages.map((page) => [page.kind, page.label])).toEqual([
            ["sheet", "Bảng giá"],
            ["sheet", "Ghi chú"],
        ])
        const [prices, notes] = read.pages
        expect(prices?.text.split("\n").slice(0, 4)).toEqual([
            "## Bảng giá",
            "",
            "Mẫu hoa | Giá (đồng) | Đơn vị | Áp dụng từ",
            "Bó hoa mẫu số 1 hồng đỏ | 105000 | bó | 01/11/2026",
        ])
        expect(notes?.text).toBe(
            "## Ghi chú\n\nGhi chú\nGiao hàng miễn phí trong nội thành cho đơn từ 500.000 đồng.\nĐặt trước 1 ngày với hoa cưới.",
        )
        expect(read.tables[0]?.rows).toHaveLength(40)
        expect(read.warnings).toEqual([{ code: DocumentWarningCode.PlaceEmpty, place: "Trống", count: null }])
    })

    it("places inline strings, booleans and gaps in their columns, and never reads a shared string for an empty cell", () => {
        const sheet =
            '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Món</t></is></c><c r="C1" t="inlineStr"><is><t>Còn</t></is></c></row>' +
            '<row r="2"><c r="A2" t="s"/><c r="B2" t="str"><v>x &amp; y</v></c><c r="C2" t="b"><v>1</v></c></row></sheetData></worksheet>'
        const bytes = zipSync({
            "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="S" r:id="rId9"/></sheets></workbook>'),
            "xl/worksheets/sheet1.xml": strToU8(sheet),
        })
        const read = workbookText(bytes)
        expect(read.tables[0]).toEqual({ name: "S", header: ["Món", "", "Còn"], rows: [["", "x & y", "TRUE"]] })
    })

    it("refuses an archive that is no workbook or no presentation", () => {
        const other = zipSync({ "word/document.xml": strToU8("<w:document/>") })
        expect(() => workbookText(other)).toThrow("not a workbook")
        expect(() => presentationText(other)).toThrow("not a presentation")
    })

    it("reads the slides in their number order, one line per paragraph, an empty slide named in a warning", () => {
        const read = presentationText(fixture("slides.pptx"))
        expect(read.pages).toEqual([
            { kind: "slide", label: "1", text: "Khuyến mãi tháng 11\nGiảm 10% cho hoa sinh nhật", transcribed: false },
            { kind: "slide", label: "2", text: "", transcribed: false },
            { kind: "slide", label: "3", text: "Liên hệ: 0901 234 567", transcribed: false },
        ])
        expect(read.warnings).toEqual([{ code: DocumentWarningCode.PlaceEmpty, place: "2", count: null }])
    })
})
