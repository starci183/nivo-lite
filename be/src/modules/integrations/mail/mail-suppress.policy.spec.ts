import { Test } from "@nestjs/testing"
import { DEFAULT_SUPPRESS, isSuppressed, maskAddress, parseSuppressList } from "./mail-suppress.policy"

const SUBJECT = Symbol("mail-suppress.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isSuppressed, maskAddress, parseSuppressList } }],
    }).compile()
    return moduleRef.get<{
        isSuppressed: typeof isSuppressed
        maskAddress: typeof maskAddress
        parseSuppressList: typeof parseSuppressList
    }>(SUBJECT)
}

describe("mail-suppress policy / parseSuppressList", () => {
    it("trims, lower-cases and drops blanks", async () => {
        const subject = await build()

        expect(subject.parseSuppressList(" *.Example.test, A@B.test ,, ")).toEqual(["*.example.test", "a@b.test"])
    })
    it("reads the default list", async () => {
        const subject = await build()

        expect(subject.parseSuppressList(DEFAULT_SUPPRESS)).toEqual(["*.example.test", "*.example.com", "*.invalid"])
    })
})

describe("mail-suppress policy / isSuppressed", () => {
    it.each([
        "x@example.test",
        "x@a.example.test",
        "X@A.B.Example.TEST",
        "x@example.com",
        "x@shop.example.com",
        "x@nivo.invalid",
    ])("holds %s", async (address) => {
        const subject = await build()

        expect(subject.isSuppressed(subject.parseSuppressList(DEFAULT_SUPPRESS), address)).toBe(true)
    })
    it.each(["x@nivo.vn", "x@notexample.test", "x@example.test.vn", "x@gmail.com"])(
        "lets %s through",
        async (address) => {
            const subject = await build()

            expect(subject.isSuppressed(subject.parseSuppressList(DEFAULT_SUPPRESS), address)).toBe(false)
        },
    )
    it("matches an exact address and a bare domain", async () => {
        const subject = await build()
        const exact = subject.parseSuppressList("Ada@Corp.test, bare.test")

        expect(subject.isSuppressed(exact, " ada@corp.test ")).toBe(true)
        expect(subject.isSuppressed(exact, "bob@corp.test")).toBe(false)
        expect(subject.isSuppressed(exact, "x@bare.test")).toBe(true)
        expect(subject.isSuppressed(exact, "x@a.bare.test")).toBe(false)
    })
    it("holds nothing with an empty list", async () => {
        const subject = await build()

        expect(subject.isSuppressed([], "x@example.test")).toBe(false)
    })
})

describe("mail-suppress policy / maskAddress", () => {
    it("hides the local part after its first character", async () => {
        const subject = await build()

        expect(subject.maskAddress("ada@example.test")).toBe("a***@example.test")
    })
    it("hides a value that is no address", async () => {
        const subject = await build()

        expect(subject.maskAddress("nobody")).toBe("***")
        expect(subject.maskAddress("@x.test")).toBe("***")
    })
})
