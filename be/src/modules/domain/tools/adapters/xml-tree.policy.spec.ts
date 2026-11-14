import { Test } from "@nestjs/testing"
import { childrenNamed, decodeEntities, findFirst, parseXml, textAt } from "./xml-tree.policy"

const SUBJECT = Symbol("xml-tree.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { childrenNamed, decodeEntities, findFirst, parseXml, textAt } }],
    }).compile()
    return moduleRef.get<typeof import("./xml-tree.policy")>(SUBJECT)
}

describe("xml-tree.policy", () => {
    it("decodes named and numeric entities and keeps unknown ones", async () => {
        const subject = await build()

        expect(subject.decodeEntities("a &amp; b &lt;&gt;&quot;&apos; &#65;&#x42;&#X43; &nbsp;")).toBe(
            "a & b <>\"' ABC &nbsp;",
        )
    })

    it("reads elements, drops prefixes and attributes, keeps CDATA and skips declarations", async () => {
        const subject = await build()
        const tree = subject.parseXml(
            '<?xml version="1.0"?><!DOCTYPE r><!-- c --><inv:R a="1"><A>x &amp; y</A><B/><A><![CDATA[<z>]]></A></inv:R>',
        )

        expect(tree?.name).toBe("R")
        expect(subject.childrenNamed(tree, "A").map((node) => node.text)).toEqual(["x & y", "<z>"])
        expect(subject.findFirst(tree ?? { name: "", children: [], text: "" }, "B")?.children).toEqual([])
        expect(subject.textAt(tree, "A")).toBe("x & y")
        expect(subject.textAt(tree, "Q")).toBe("")
        expect(subject.textAt(null, "A")).toBe("")
        expect(subject.childrenNamed(null, "A")).toEqual([])
    })

    it("ends a tag name at the first whitespace, slash or bracket, as the regex replace did", async () => {
        const subject = await build()
        const tree = subject.parseXml('<p:R\tx="1"><A\ny="2">a</A ><B/><C\r/><D z="/">d</D></p:R>')

        expect(tree?.name).toBe("R")
        expect(tree?.children.map((node) => node.name)).toEqual(["A", "B", "C", "D"])
        expect(subject.textAt(tree, "D")).toBe("d")
        expect(subject.parseXml("<a:b:c>x</a:b:c>")?.name).toBe("b:c")
    })

    it("reads a long tag full of separators", async () => {
        const subject = await build()
        const name = "n".repeat(50_000)
        const attributes = " /".repeat(50_000)
        const tree = subject.parseXml(`<${name}${attributes}x>t</${name}${attributes}>`)

        expect(tree?.name).toBe(name)
        expect(tree?.text).toBe("t")
    })

    it("answers null for markup that is not well formed", async () => {
        const subject = await build()

        expect(subject.parseXml("<a>x</a> tail")?.text).toBe("x")
        expect(subject.parseXml("")).toBeNull()
        expect(subject.parseXml("<a><!-- open</a>")).toBeNull()
        expect(subject.parseXml("<a><![CDATA[open</a>")).toBeNull()
        expect(subject.parseXml("<a")).toBeNull()
        expect(subject.parseXml("<a></b>")).toBeNull()
        expect(subject.parseXml("<a></a></a>")).toBeNull()
        expect(subject.parseXml("<a><b></a>")).toBeNull()
        expect(subject.parseXml("<a></a><b></b>")).toBeNull()
        expect(subject.parseXml("<a>")).toBeNull()
    })
})
