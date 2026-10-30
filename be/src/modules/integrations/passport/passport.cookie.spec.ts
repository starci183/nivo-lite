import { Test } from "@nestjs/testing"
import { cookieValue } from "./passport.cookie"

const SUBJECT = Symbol("passport.cookie")
type Subject = { cookieValue: typeof cookieValue }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cookieValue } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("cookieValue", () => {
    it("reads one cookie out of a header that carries several", async () => {
        const subject = await build()

        expect(subject.cookieValue("a=1; nivo_refresh=token-value; b=2", "nivo_refresh")).toBe("token-value")
    })

    it("answers empty text when the header lacks the cookie or is empty", async () => {
        const subject = await build()

        expect(subject.cookieValue("a=1; b=2", "nivo_refresh")).toBe("")
        expect(subject.cookieValue("", "nivo_refresh")).toBe("")
    })

    it("does not match a cookie whose name only ends with the wanted one", async () => {
        const subject = await build()

        expect(subject.cookieValue("x_nivo_refresh=nope", "nivo_refresh")).toBe("")
    })
})
