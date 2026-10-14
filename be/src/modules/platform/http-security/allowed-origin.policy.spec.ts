import { isAllowedOrigin } from "./allowed-origin.policy"

describe("isAllowedOrigin", () => {
    it.each(["https://app.test", "http://localhost", "http://localhost:3000", "https://[::1]:8443"])(
        "accepts the canonical HTTP(S) origin %s",
        (origin) => {
            expect(isAllowedOrigin(origin)).toBe(true)
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
    ])("refuses the noncanonical or non-HTTP(S) origin %s", (origin) => {
        expect(isAllowedOrigin(origin)).toBe(false)
    })
})
