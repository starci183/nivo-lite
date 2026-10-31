import { Test } from "@nestjs/testing"
import { scrubbed } from "./native-scrub.policy"

/** The members of the subject under test. */
interface Subject {
    readonly scrubbed: typeof scrubbed
}

const SUBJECT = Symbol("native-scrub.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { scrubbed } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("native-scrub.policy", () => {
    it("replaces emails, phone numbers in their usual forms and long digit runs with a label", async () => {
        const subject = await build()

        expect(subject.scrubbed("Contact lan.nguyen@shop.vn or 0901 234 567 / +84 90-123-4567 / 090.123.4567")).toBe(
            "Contact [email] or [phone] / [phone] / [phone]",
        )
        expect(subject.scrubbed("Account 1234567890123 and card 4111111111111111.")).toBe(
            "Account [number] and card [number].",
        )
    })

    it("replaces a card written in groups and an identity number, and keeps a short number", async () => {
        const subject = await build()

        expect(subject.scrubbed("Card 4111 1111 1111 1111, id 123456789012.")).toBe("Card [number], id [number].")
        expect(subject.scrubbed("Order 12345678 on 2026-10-31")).toBe("Order 12345678 on 2026-10-31")
    })

    it("keeps prices, dates, quantities and short numbers", async () => {
        const subject = await build()
        const text = "Combo 1.500.000 VND, 2.500.000.000 VND for 12 guests on 2026-10-31, open 8 to 21, room 302."

        expect(subject.scrubbed(text)).toBe(text)
    })

    it("drops characters that draw nothing, so words cannot be hidden in the text", async () => {
        const subject = await build()

        expect(subject.scrubbed("ign​ore⁠ this\u{E0041}")).toBe("ignore this")
    })
})
