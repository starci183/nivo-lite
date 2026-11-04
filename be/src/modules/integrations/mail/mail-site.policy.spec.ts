import { Test } from "@nestjs/testing"
import { isPublicSite } from "./mail-site.policy"

const SUBJECT = Symbol("mail-site.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isPublicSite } }],
    }).compile()
    return moduleRef.get<typeof import("./mail-site.policy")>(SUBJECT)
}

describe("mail site policy / isPublicSite", () => {
    it("takes a public https origin as a public site", async () => {
        const subject = await build()
        expect(subject.isPublicSite("https://nivo.vn")).toBe(true)
    })

    it("takes a missing, unparsable, plain-http or local address as a development site", async () => {
        const subject = await build()
        expect(subject.isPublicSite(undefined)).toBe(false)
        expect(subject.isPublicSite("not a url")).toBe(false)
        expect(subject.isPublicSite("http://nivo.vn")).toBe(false)
        expect(subject.isPublicSite("https://localhost")).toBe(false)
        expect(subject.isPublicSite("https://127.0.0.1")).toBe(false)
        expect(subject.isPublicSite("https://app.localhost")).toBe(false)
    })
})
