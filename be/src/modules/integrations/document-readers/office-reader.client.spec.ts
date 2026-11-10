import { readFileSync } from "node:fs"
import { join } from "node:path"
import mammoth from "mammoth"
import { strToU8, zipSync } from "fflate"
import { DocumentRefusalCode } from "./document-readers.contracts"
import type { DocumentLibraries } from "./document-readers.contracts"
import { readSlides, readWord, readWorkbook } from "./office-reader.client"

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

/** The Word library for real; the others are never reached by these readers. */
const libraries: DocumentLibraries = {
    wordToHtml: async (bytes) => (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value,
    openPdf: () => Promise.reject(new Error("unused")),
    pictures: () => Promise.reject(new Error("unused")),
    heicToJpeg: () => Promise.reject(new Error("unused")),
}

describe("office readers", () => {
    it("reads a Word file into headings, paragraphs and its price table with the header first", async () => {
        const read = await readWord(fixture("menu.docx"), libraries)
        expect(read).toMatchObject({ kind: "ok" })
        if (read.kind !== "ok") return
        expect(read.value.text).toBe(
            [
                "# Giờ mở cửa",
                "",
                "Tiệm mở cửa từ 7 giờ sáng đến 21 giờ tối, tất cả các ngày trong tuần, kể cả Chủ nhật và ngày lễ.",
                "",
                "# Giao hàng",
                "",
                "Giao hàng trong 2 giờ ở nội thành; phí giao 30.000 đồng, miễn phí cho đơn từ 500.000 đồng.",
                "",
                "# Bảng giá",
                "",
                "Món | Giá",
                "Bó hồng đỏ 10 bông | 350.000",
                "Lẵng hướng dương | 520.000",
            ].join("\n"),
        )
        expect(read.value.sections?.map((section) => section.heading)).toEqual(["Giờ mở cửa", "Giao hàng", "Bảng giá"])
        expect(read.value.tables).toHaveLength(1)
        expect(read.value).toMatchObject({ reader: "docx", pageCount: null, transcribed: false, warnings: [] })
    })

    it("refuses a locked Word file, an old .doc saved under a new name, and bytes that are no archive", async () => {
        await expect(readWord(fixture("locked.docx"), libraries)).resolves.toEqual({
            kind: "refused",
            code: DocumentRefusalCode.PasswordProtected,
            params: undefined,
        })
        await expect(readWord(fixture("legacy.doc"), libraries)).resolves.toMatchObject({
            code: DocumentRefusalCode.LegacyOffice,
        })
        await expect(readWord(new TextEncoder().encode("plain"), libraries)).resolves.toMatchObject({
            code: DocumentRefusalCode.Unreadable,
        })
        const broken = zipSync({ "x.txt": strToU8("x") })
        await expect(readWord(broken, libraries)).resolves.toMatchObject({ code: DocumentRefusalCode.Unreadable })
    })

    it("reads a workbook sheet by sheet with the sheet count, and refuses a locked or broken one", () => {
        const read = readWorkbook(fixture("price-list.xlsx"))
        expect(read).toMatchObject({ kind: "ok", value: { reader: "xlsx", sheetCount: 3, transcribed: false } })
        if (read.kind === "ok") expect(read.value.text.startsWith("## Bảng giá\n\nMẫu hoa | Giá (đồng)")).toBe(true)
        expect(readWorkbook(fixture("locked.docx"))).toMatchObject({ code: DocumentRefusalCode.PasswordProtected })
        expect(readWorkbook(zipSync({ "a.xml": strToU8("<a/>") }))).toMatchObject({
            code: DocumentRefusalCode.Unreadable,
        })
    })

    it("reads a presentation slide by slide with the slide count, and refuses one that is no presentation", () => {
        const read = readSlides(fixture("slides.pptx"))
        expect(read).toMatchObject({ kind: "ok", value: { reader: "pptx", pageCount: 3 } })
        if (read.kind === "ok") {
            expect(read.value.text).toBe("Khuyến mãi tháng 11\nGiảm 10% cho hoa sinh nhật\n\nLiên hệ: 0901 234 567")
        }
        expect(readSlides(fixture("price-list.xlsx"))).toMatchObject({ code: DocumentRefusalCode.Unreadable })
        expect(readSlides(fixture("legacy.doc"))).toMatchObject({ code: DocumentRefusalCode.LegacyOffice })
    })
})
