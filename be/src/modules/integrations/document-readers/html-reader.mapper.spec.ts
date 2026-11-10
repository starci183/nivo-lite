import { readFileSync } from "node:fs"
import { join } from "node:path"
import { chunkPassages } from "@modules/domain/knowledge-chunks"
import { decodeEntities, htmlText } from "./html-reader.mapper"

const page = readFileSync(join(__dirname, "fixtures", "about.html"), "utf8")

describe("html reader mapper", () => {
    it("writes out named and numeric entities and leaves unknown ones", () => {
        expect(decodeEntities("A &amp; B &#7871; &#x1EBF; &nbsp;&bogus;")).toBe("A & B ế ế  &bogus;")
    })

    it("turns a page into headings, paragraphs, dashes and one table block, dropping scripts, styles and comments", () => {
        const read = htmlText(page)
        expect(read.text).toBe(
            [
                "Trang chủ",
                "",
                "# Về tiệm & dịch vụ",
                "",
                "Tiệm hoa ở Quận 3.",
                "Mở cửa 7 giờ.",
                "",
                "- Hoa cưới",
                "- Hoa sinh nhật",
                "",
                "## Giá",
                "",
                "Món | Giá",
                "Bó hồng | 350.000",
                "Lẵng / lớn | 520.000",
            ].join("\n"),
        )
        expect(read.text).not.toMatch(/alert|color|ẩn/u)
        expect(read.tables).toEqual([
            {
                name: null,
                header: ["Món", "Giá"],
                rows: [
                    ["Bó hồng", "350.000"],
                    ["Lẵng / lớn", "520.000"],
                ],
            },
        ])
        expect(read.sections.map((section) => section.heading)).toEqual([null, "Về tiệm & dịch vụ", "Giá"])
    })

    it("gives the chunker a table it cuts by row with the header in every passage", () => {
        const rows = Array.from(
            { length: 60 },
            (_, index) => `<tr><td>Hoa mẫu ${index}</td><td>${index}00.000 đồng mỗi bó</td></tr>`,
        )
        const read = htmlText(`<h2>Bảng giá</h2><table><tr><th>Món</th><th>Giá</th></tr>${rows.join("")}</table>`)
        const passages = chunkPassages(read.text)
        expect(passages.length).toBeGreaterThan(1)
        const rowPassages = passages.filter((passage) => passage.includes("Hoa mẫu"))
        expect(rowPassages.length).toBeGreaterThan(1)
        expect(rowPassages.every((passage) => passage.startsWith("Món | Giá\n"))).toBe(true)
    })

    it("reads a table nested in a cell as the text of that cell and skips empty headings and tables", () => {
        const read = htmlText(
            "<h3> </h3><table><tr><td><table><tr><td>a</td></tr></table></td><td>b</td></tr></table><table></table>",
        )
        expect(read.tables.map((table) => table.header)).toEqual([["a"], ["a", "b"]])
        expect(read.text).not.toContain("#")
    })
})
