import { Test } from "@nestjs/testing"
import { strToU8, zipSync } from "fflate"
import { DocumentsErrorCode } from "./errors/documents.error"
import { XLSX_MAX_ROWS, captured, pptxToText, xlsxToText } from "./ooxml.mapper"

const SUBJECT = Symbol("ooxml.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { captured, pptxToText, xlsxToText } }],
    }).compile()
    return moduleRef.get<Pick<typeof import("./ooxml.mapper"), "captured" | "pptxToText" | "xlsxToText">>(SUBJECT)
}

const zipOf = (parts: Readonly<Record<string, string>>): Uint8Array =>
    zipSync(Object.fromEntries(Object.entries(parts).map(([name, xml]) => [name, strToU8(xml)])))

const WORKBOOK = `<workbook><sheets>
<sheet name="Prices &amp; Menu" sheetId="1" r:id="rId1"/>
<sheet name="Hidden" sheetId="2" r:id="rId9"/>
<sheet sheetId="3"/>
<sheet name="Absolute" sheetId="4" r:id="rId4"/>
</sheets></workbook>`

const RELS = `<Relationships>
<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId4" Target="/xl/worksheets/special.xml"/>
<Relationship Target="worksheets/orphan.xml"/>
</Relationships>`

const SHARED = `<sst>
<si><t>Latte</t></si>
<si><r><t>Mo</t></r><r><t>cha</t></r><rPh sb="0" eb="1"><t>phonetic</t></rPh></si>
</sst>`

const SHEET_ONE = [
    '<worksheet><sheetData>\n<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s">',
    '<v>1</v></c><c r="D1"><v>45&amp;6</v></c></row>\n<row r="2"><c r="A2" t="inlineStr">',
    '<is><t>Inline &#65;&#x42;&#0;&#x110000;</t></is></c><c r="B2" t="b"><v>1</v></c>',
    '<c r="C2" t="b"><v>0</v></c><c r="D2" t="b"><v>2</v></c></row>\n<row r="3">',
    '<c t="s"><v>9</v></c><c t="s"/><c><v>7</v></c><c/></row>\n<row r="4"><c r="A4"></c>',
    '</row>\n<row r="5"/>\n<row r="6"><c r="AB6"><v>x</v></c></row>\n<row r="7">',
    '<c r="1"><v>y</v></c></row>\n</sheetData></worksheet>',
].join("")

const SHEET_THREE = `<worksheet><sheetData><row><c><v>third</v></c></row></sheetData></worksheet>`

const SPECIAL = `<worksheet><sheetData><row><c r="A1"><v>abs</v></c></row></sheetData></worksheet>`

describe("xlsxToText", () => {
    it("writes each sheet as a table of cells joined by pipes with its decoded name", async () => {
        const subject = await build()

        const text = subject.xlsxToText(
            zipOf({
                "xl/workbook.xml": WORKBOOK,
                "xl/_rels/workbook.xml.rels": RELS,
                "xl/sharedStrings.xml": SHARED,
                "xl/worksheets/sheet1.xml": SHEET_ONE,
                "xl/worksheets/sheet3.xml": SHEET_THREE,
                "xl/worksheets/special.xml": SPECIAL,
            }),
        )

        const wide = [...Array.from({ length: 27 }, () => ""), "x"].join(" | ")
        expect(text).toBe(
            [
                `## Prices & Menu\nLatte | Mocha |  | 45&6\nInline AB | TRUE | FALSE\n |  | 7\n${wide}\ny`,
                "## Sheet 3\nthird",
                "## Absolute\nabs",
            ].join("\n\n"),
        )
    })

    it("reads a workbook with no relationships, no shared strings and a sheet part found by position", async () => {
        const subject = await build()

        const text = subject.xlsxToText(
            zipOf({
                "xl/workbook.xml": '<workbook><sheet name="Only"/></workbook>',
                "xl/worksheets/sheet1.xml": SHEET_THREE,
            }),
        )

        expect(text).toBe("## Only\nthird")
    })

    it("stops a sheet at the row limit", async () => {
        const subject = await build()

        const rows = Array.from({ length: XLSX_MAX_ROWS + 5 }, (_, index) => `<row><c><v>${index}</v></c></row>`).join(
            "",
        )
        const text = subject.xlsxToText(
            zipOf({
                "xl/workbook.xml": '<workbook><sheet name="Long"/></workbook>',
                "xl/worksheets/sheet1.xml": `<worksheet>${rows}</worksheet>`,
            }),
        )

        expect(text.split("\n")).toHaveLength(XLSX_MAX_ROWS + 1)
    })

    it("leaves out sheets that have no rows", async () => {
        const subject = await build()

        const text = subject.xlsxToText(
            zipOf({
                "xl/workbook.xml": '<workbook><sheet name="Empty"/></workbook>',
                "xl/worksheets/sheet1.xml": "<worksheet></worksheet>",
            }),
        )

        expect(text).toBe("")
    })

    it("refuses an archive that is not a workbook", async () => {
        const subject = await build()

        expect(() => subject.xlsxToText(zipOf({ "other.xml": "<a/>" }))).toThrow(
            expect.objectContaining({ code: DocumentsErrorCode.FileInvalid }),
        )
    })
})

const SLIDE_ONE = `<p:sld><a:p><a:r><a:t>Welcome &lt;team&gt;</a:t></a:r></a:p>
<a:p><a:r><a:t>line one</a:t></a:r><a:br/><a:r><a:t>line two</a:t></a:r></a:p>
<a:p><a:fld id="1" type="slidenum"><a:t>1</a:t></a:fld></a:p>
<a:p></a:p></p:sld>`

const SLIDE_TWO = "<p:sld><a:p><a:r><a:t>Second</a:t></a:r></a:p></p:sld>"

const SLIDE_TEN = "<p:sld><a:p><a:r><a:t>Tenth</a:t></a:r></a:p></p:sld>"

const EMPTY_SLIDE = "<p:sld><a:p></a:p></p:sld>"

const NOTES = "<p:notes><a:p><a:r><a:t>Say hello</a:t></a:r></a:p></p:notes>"

describe("pptxToText", () => {
    it("writes the slides in numeric order with their text and speaker notes", async () => {
        const subject = await build()

        const text = subject.pptxToText(
            zipOf({
                "ppt/slides/slide10.xml": SLIDE_TEN,
                "ppt/slides/slide2.xml": SLIDE_TWO,
                "ppt/slides/slide1.xml": SLIDE_ONE,
                "ppt/slides/slide3.xml": EMPTY_SLIDE,
                "ppt/slides/_rels/slide1.xml.rels":
                    '<Relationships><Relationship Id="r1" Target="../notesSlides/notesSlide1.xml"/></Relationships>',
                "ppt/slides/_rels/slide2.xml.rels":
                    '<Relationships><Relationship Id="r1" Target="../slideLayouts/layout1.xml"/></Relationships>',
                "ppt/slides/_rels/slide10.xml.rels":
                    '<Relationships><Relationship Id="r1" Target="../notesSlides/notesSlide10.xml"/></Relationships>',
                "ppt/notesSlides/notesSlide1.xml": NOTES,
            }),
        )

        expect(text).toBe(
            [
                "## Slide 1\nWelcome <team>\nline one\nline two\nNotes:\nSay hello",
                "## Slide 2\nSecond",
                "## Slide 4\nTenth",
            ].join("\n\n"),
        )
    })

    it("refuses an archive with no slides", async () => {
        const subject = await build()

        expect(() => subject.pptxToText(zipOf({ "other.xml": "<a/>" }))).toThrow(
            expect.objectContaining({ code: DocumentsErrorCode.FileInvalid }),
        )
    })
})

describe("captured", () => {
    it("answers an empty text for a group that took no part in the match", async () => {
        const subject = await build()

        const match = /a(b)?/u.exec("a")

        expect(match === null ? null : subject.captured(match, 1)).toBe("")
    })

    it("answers the text of a group that matched", async () => {
        const subject = await build()

        const match = /a(b)?/u.exec("ab")

        expect(match === null ? null : subject.captured(match, 1)).toBe("b")
    })
})
