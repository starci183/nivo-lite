import { DEFAULT_SUPPRESS, isSuppressed, maskAddress, parseSuppressList } from "./mail-suppress.policy"

describe("mail-suppress policy / parseSuppressList", () => {
    it("trims, lower-cases and drops blanks", () => {
        expect(parseSuppressList(" *.Example.test, A@B.test ,, ")).toEqual(["*.example.test", "a@b.test"])
    })
    it("reads the default list", () => {
        expect(parseSuppressList(DEFAULT_SUPPRESS)).toEqual(["*.example.test", "*.example.com", "*.invalid"])
    })
})

describe("mail-suppress policy / isSuppressed", () => {
    const list = parseSuppressList(DEFAULT_SUPPRESS)

    it.each([
        "x@example.test",
        "x@a.example.test",
        "X@A.B.Example.TEST",
        "x@example.com",
        "x@shop.example.com",
        "x@nivo.invalid",
    ])("holds %s", (address) => {
        expect(isSuppressed(list, address)).toBe(true)
    })
    it.each(["x@nivo.vn", "x@notexample.test", "x@example.test.vn", "x@gmail.com"])("lets %s through", (address) => {
        expect(isSuppressed(list, address)).toBe(false)
    })
    it("matches an exact address and a bare domain", () => {
        const exact = parseSuppressList("Ada@Corp.test, bare.test")

        expect(isSuppressed(exact, " ada@corp.test ")).toBe(true)
        expect(isSuppressed(exact, "bob@corp.test")).toBe(false)
        expect(isSuppressed(exact, "x@bare.test")).toBe(true)
        expect(isSuppressed(exact, "x@a.bare.test")).toBe(false)
    })
    it("holds nothing with an empty list", () => {
        expect(isSuppressed([], "x@example.test")).toBe(false)
    })
})

describe("mail-suppress policy / maskAddress", () => {
    it("hides the local part after its first character", () => {
        expect(maskAddress("ada@example.test")).toBe("a***@example.test")
    })
    it("hides a value that is no address", () => {
        expect(maskAddress("nobody")).toBe("***")
        expect(maskAddress("@x.test")).toBe("***")
    })
})
