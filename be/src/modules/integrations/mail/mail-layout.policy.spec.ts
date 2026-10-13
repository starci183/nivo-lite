import { NIVO_ACCENT, oneLine, renderEmail, renderTemplate } from "./mail-layout.policy"

describe("mail-layout policy", () => {
    describe("renderTemplate", () => {
        it("fills single and double brace placeholders, empties unknown ones and drops control characters", () => {
            const text = renderTemplate("Hi {name}, order {{ no }} total {total} {missing}.\u0007", {
                name: "Minh",
                no: 12,
                total: null,
            })

            expect(text).toBe("Hi Minh, order 12 total  .")
        })
    })

    describe("oneLine", () => {
        it("joins lines and bounds the length", () => {
            expect(oneLine("a\r\nb\n\nc ")).toBe("a b c")
            expect(oneLine("x".repeat(500))).toHaveLength(200)
            expect(oneLine("x".repeat(500), 10)).toHaveLength(10)
        })
    })

    describe("renderEmail", () => {
        const base = { shopName: "Shop <A>", title: "Hello", footer: "Sent by Shop", lang: "en" }

        it("renders paragraphs and bullet lists in the shop colour and escapes everything", () => {
            const mail = renderEmail({
                ...base,
                accent: "#112233",
                body: "Line one\nLine <two>\n\n- first\n- second\ntail\n\n- only",
            })

            expect(mail.html).toContain("background:#112233")
            expect(mail.html).toContain('<html lang="en">')
            expect(mail.html).toContain('<p style="margin:0 0 16px">Line one<br>Line &lt;two&gt;</p>')
            expect(mail.html).toContain('<li style="margin:0 0 6px">first</li><li style="margin:0 0 6px">second</li>')
            expect(mail.html).toContain('<p style="margin:0 0 16px">tail</p>')
            expect(mail.html).toContain('<li style="margin:0 0 6px">only</li>')
            expect(mail.html).toContain("Shop &lt;A&gt;")
            expect(mail.html).toContain("Sent by Shop")
        })

        it("falls back to the default colour for anything but #rrggbb", () => {
            expect(renderEmail({ ...base, accent: "red", body: "x" }).html).toContain(`background:${NIVO_ACCENT}`)
            expect(renderEmail({ ...base, body: "x" }).html).toContain(`background:${NIVO_ACCENT}`)
        })

        it("writes the text alternative with the shop name, the body and the footer", () => {
            const mail = renderEmail({ ...base, body: "Line one\r\nLine two  " })

            expect(mail.text).toBe("Shop <A>\n\nLine one\nLine two\n\n--\nSent by Shop\n")
        })
    })
})
