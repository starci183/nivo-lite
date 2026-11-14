import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { chunkPassages } from "@modules/domain/knowledge-chunks"
import { decodeEntities as decodeEntitiesSubject, htmlText as htmlTextSubject } from "./html-reader.mapper"

const SUBJECT = Symbol("html-reader.mapper")

describe("html-reader.mapper built the way Nest does", () => {
    let decodeEntities: typeof decodeEntitiesSubject
    let htmlText: typeof htmlTextSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ decodeEntities: typeof decodeEntitiesSubject; htmlText: typeof htmlTextSubject }>({ decodeEntities: decodeEntitiesSubject, htmlText: htmlTextSubject }) }],
        }).compile()
        ;({ decodeEntities, htmlText } = moduleRef.get<{ decodeEntities: typeof decodeEntitiesSubject; htmlText: typeof htmlTextSubject }>(SUBJECT))
    })

const page = readFileSync(join(__dirname, "fixtures", "about.html"), "utf8")

describe("html reader mapper", () => {
    it("writes out named and numeric entities and leaves unknown ones", () => {
        expect(decodeEntities("A &amp; B &#7871; &#x1EBF; &nbsp;&bogus;")).toBe("A & B \u1EBF \u1EBF  &bogus;")
    })

    it("turns a page into headings, paragraphs, dashes and one table block, dropping scripts, styles and comments", () => {
        const read = htmlText(page)
        expect(read.text).toBe(
            [
                "Trang ch\u1EE7",
                "",
                "# V\u1EC1 ti\u1EC7m & d\u1ECBch v\u1EE5",
                "",
                "Ti\u1EC7m hoa \u1EDF Qu\u1EADn 3.",
                "M\u1EDF c\u1EEDa 7 gi\u1EDD.",
                "",
                "- Hoa c\u01B0\u1EDBi",
                "- Hoa sinh nh\u1EADt",
                "",
                "## Gi\u00E1",
                "",
                "M\u00F3n | Gi\u00E1",
                "B\u00F3 h\u1ED3ng | 350.000",
                "L\u1EB5ng / l\u1EDBn | 520.000",
            ].join("\n"),
        )
        expect(read.text).not.toMatch(/alert|color|\u1EA9n/u)
        expect(read.tables).toEqual([
            {
                name: null,
                header: ["M\u00F3n", "Gi\u00E1"],
                rows: [
                    ["B\u00F3 h\u1ED3ng", "350.000"],
                    ["L\u1EB5ng / l\u1EDBn", "520.000"],
                ],
            },
        ])
        expect(read.sections.map((section) => section.heading)).toEqual([null, "V\u1EC1 ti\u1EC7m & d\u1ECBch v\u1EE5", "Gi\u00E1"])
    })

    it("gives the chunker a table it cuts by row with the header in every passage", () => {
        const rows = Array.from(
            { length: 60 },
            (_, index) => `<tr><td>Hoa m\u1EABu ${index}</td><td>${index}00.000 \u0111\u1ED3ng m\u1ED7i b\u00F3</td></tr>`,
        )
        const read = htmlText(`<h2>B\u1EA3ng gi\u00E1</h2><table><tr><th>M\u00F3n</th><th>Gi\u00E1</th></tr>${rows.join("")}</table>`)
        const passages = chunkPassages(read.text)
        expect(passages.length).toBeGreaterThan(1)
        const rowPassages = passages.filter((passage) => passage.includes("Hoa m\u1EABu"))
        expect(rowPassages.length).toBeGreaterThan(1)
        expect(rowPassages.every((passage) => passage.startsWith("M\u00F3n | Gi\u00E1\n"))).toBe(true)
    })

    it("reads a table nested in a cell as the text of that cell and skips empty headings and tables", () => {
        const read = htmlText(
            "<h3> </h3><table><tr><td><table><tr><td>a</td></tr></table></td><td>b</td></tr></table><table></table>",
        )
        expect(read.tables.map((table) => table.header)).toEqual([["a"], ["a", "b"]])
        expect(read.text).not.toContain("#")
    })
})
})
