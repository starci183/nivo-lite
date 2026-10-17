import { Test } from "@nestjs/testing"
import {
    NIVO_ACCENT,
    renderTemplate as realRenderTemplate,
    oneLine as realOneLine,
    renderEmail as realRenderEmail,
} from "./mail-layout.policy"

const SUBJECT = Symbol("mail-layout.policy")

type Subject = Pick<typeof import("./mail-layout.policy"), "renderTemplate" | "oneLine" | "renderEmail">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    renderTemplate: realRenderTemplate,
                    oneLine: realOneLine,
                    renderEmail: realRenderEmail,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const base = { shopName: "Shop <A>", title: "Hello", footer: "Sent by Shop", lang: "en" }

describe("mail-layout policy / renderTemplate", () => {
    it("fills single and double brace placeholders, empties unknown ones and drops control characters", async () => {
        const subject = await build()

        const text = subject.renderTemplate("Hi {name}, order {{ no }} total {total} {missing}.\u0007", {
            name: "Minh",
            no: 12,
            total: null,
        })

        expect(text).toBe("Hi Minh, order 12 total  .")
    })
})

describe("mail-layout policy / oneLine", () => {
    it("joins lines and bounds the length", async () => {
        const subject = await build()

        expect(subject.oneLine("a\r\nb\n\nc ")).toBe("a b c")
        expect(subject.oneLine("x".repeat(500))).toHaveLength(200)
        expect(subject.oneLine("x".repeat(500), 10)).toHaveLength(10)
    })
})

describe("mail-layout policy / renderEmail", () => {
    it("renders paragraphs and bullet lists in the shop colour and escapes everything", async () => {
        const subject = await build()

        const input = {
            ...base,
            accent: "#112233",
            body: "Line one\nLine <two>\n\n- first\n- second\ntail\n\n- only",
        }
        const mail = subject.renderEmail(input)

        expect(mail.html).toContain("background:#112233")
        expect(mail.html).toContain('<html lang="en">')
        expect(mail.html).toContain('<p style="margin:0 0 16px">Line one<br>Line &lt;two&gt;</p>')
        expect(mail.html).toContain('<li style="margin:0 0 6px">first</li><li style="margin:0 0 6px">second</li>')
        expect(mail.html).toContain('<p style="margin:0 0 16px">tail</p>')
        expect(mail.html).toContain('<li style="margin:0 0 6px">only</li>')
        expect(mail.html).toContain("Shop &lt;A&gt;")
        expect(mail.html).toContain("Sent by Shop")
    })
    it("falls back to the default colour for anything but #rrggbb", async () => {
        const subject = await build()

        expect(subject.renderEmail({ ...base, accent: "red", body: "x" }).html).toContain(`background:${NIVO_ACCENT}`)
        expect(subject.renderEmail({ ...base, body: "x" }).html).toContain(`background:${NIVO_ACCENT}`)
    })
    it("writes the text alternative with the shop name, the body and the footer", async () => {
        const subject = await build()

        const input = { ...base, body: "Line one\r\nLine two  " }
        const mail = subject.renderEmail(input)

        expect(mail.text).toBe("Shop <A>\n\nLine one\nLine two\n\n--\nSent by Shop\n")
    })
})
