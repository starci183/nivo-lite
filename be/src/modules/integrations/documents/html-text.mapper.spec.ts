import { Test } from "@nestjs/testing"
import { htmlToText, pageTitle } from "./html-text.mapper"

const SUBJECT = Symbol("html-text.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { htmlToText, pageTitle } }],
    }).compile()
    return moduleRef.get<typeof import("./html-text.mapper")>(SUBJECT)
}

describe("htmlToText", () => {
    it.each([
        ["a<>b<x>c", "a<>b c"],
        ["a<<x>b", "a b"],
        ["a<broken", "a<broken"],
        ["<".repeat(10000), "<".repeat(10000)],
    ])("retains unmatched or empty brackets while removing tag runs", async (html, expected) => {
        const subject = await build()

        expect(subject.htmlToText(html)).toBe(expected)
    })

    it("drops scripts, styles and tags and keeps block ends as line breaks", async () => {
        const subject = await build()

        const html =
            "<style>p{}</style><script>var x</script><h1>Menu</h1><p>Latte &amp; " +
            "mocha</p><ul><li>One</li><li>Two</li></ul>a<br/>b<br>c"

        expect(subject.htmlToText(html)).toBe("Menu\n Latte & mocha\n One\n Two\n a\nb\nc")
    })

    it("decodes the common entities and collapses spaces and blank lines", async () => {
        const subject = await build()

        expect(subject.htmlToText("<p>a&nbsp;&nbsp;&lt;b&gt; &quot;q&quot; &#39;s&#39;</p>\n\n\n<p>  next  </p>")).toBe(
            "a <b> \"q\" 's'\n\n next",
        )
    })
})

describe("pageTitle", () => {
    it("answers the title as plain text", async () => {
        const subject = await build()

        expect(subject.pageTitle("<html><head><title> Our &amp; Menu </title></head></html>")).toBe("Our & Menu")
    })

    it("cuts a long title to 160 characters", async () => {
        const subject = await build()

        expect(subject.pageTitle(`<title>${"t".repeat(200)}</title>`)).toHaveLength(160)
    })

    it("answers null for a page with no title or an empty one", async () => {
        const subject = await build()

        expect(subject.pageTitle("<html></html>")).toBeNull()
        expect(subject.pageTitle("<title>  </title>")).toBeNull()
    })
})
