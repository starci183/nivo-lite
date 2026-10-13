import { htmlToText, pageTitle } from "./html-text.mapper"

describe("htmlToText", () => {
    it("drops scripts, styles and tags and keeps block ends as line breaks", () => {
        const html =
            "<style>p{}</style><script>var x</script><h1>Menu</h1><p>Latte &amp; mocha</p><ul><li>One</li><li>Two</li></ul>a<br/>b<br>c"

        expect(htmlToText(html)).toBe("Menu\n Latte & mocha\n One\n Two\n a\nb\nc")
    })

    it("decodes the common entities and collapses spaces and blank lines", () => {
        expect(htmlToText("<p>a&nbsp;&nbsp;&lt;b&gt; &quot;q&quot; &#39;s&#39;</p>\n\n\n<p>  next  </p>")).toBe(
            "a <b> \"q\" 's'\n\n next",
        )
    })
})

describe("pageTitle", () => {
    it("answers the title as plain text", () => {
        expect(pageTitle("<html><head><title> Our &amp; Menu </title></head></html>")).toBe("Our & Menu")
    })

    it("cuts a long title to 160 characters", () => {
        expect(pageTitle(`<title>${"t".repeat(200)}</title>`)).toHaveLength(160)
    })

    it("answers null for a page with no title or an empty one", () => {
        expect(pageTitle("<html></html>")).toBeNull()
        expect(pageTitle("<title>  </title>")).toBeNull()
    })
})
