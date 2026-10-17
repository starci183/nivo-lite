import { Test } from "@nestjs/testing"
import { isAllowedOrigin } from "./allowed-origin.policy"

const SUBJECT = Symbol("allowed-origin.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isAllowedOrigin } }],
    }).compile()
    return moduleRef.get<typeof import("./allowed-origin.policy")>(SUBJECT)
}

describe("isAllowedOrigin", () => {
    it.each(["https://app.test", "http://localhost", "http://localhost:3000", "https://[::1]:8443"])(
        "accepts the canonical HTTP(S) origin %s",
        async (origin) => {
            const subject = await buildSubject()

            expect(subject.isAllowedOrigin(origin)).toBe(true)
        },
    )

    it.each([
        "",
        "*",
        "null",
        "not an origin",
        "/relative",
        "//app.test",
        "https://app.test/",
        "https://app.test/path",
        "https://app.test?query=value",
        "https://app.test#fragment",
        "https://user:password@app.test",
        "ftp://app.test",
        "file:///app.test",
        "blob:https://app.test/id",
        "https://APP.test",
        "https://app.test:443",
        " https://app.test",
        "https://app.test\n",
    ])("refuses the noncanonical or non-HTTP(S) origin %s", async (origin) => {
        const subject = await buildSubject()

        expect(subject.isAllowedOrigin(origin)).toBe(false)
    })
})
