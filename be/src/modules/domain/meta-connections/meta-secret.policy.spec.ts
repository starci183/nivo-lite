import { connectionIdOfReturn, parseMetaSecret } from "./meta-secret.policy"

describe("parseMetaSecret", () => {
    it("reads the Page, user and Instagram credentials without changing their values", () => {
        const secret = {
            userToken: "user-token",
            pageToken: "page-token",
            pageId: "PAGE-1",
            igId: "IG-1",
        }

        expect(parseMetaSecret(JSON.stringify(secret))).toEqual(secret)
        expect(parseMetaSecret("{}")).toEqual({})
    })

    it.each(["not json", "", "null", "[]", '["page-token"]', '"page-token"', "1", "true"])(
        "treats %j as an empty credential",
        (plain) => {
            expect(parseMetaSecret(plain)).toEqual({})
        },
    )
})

describe("connectionIdOfReturn", () => {
    const id = "01234567-89ab-cdef-0123-456789abcdef"

    it("reads a UUID from a relative callback return path", () => {
        expect(connectionIdOfReturn(`/connections?connect=meta&id=${id}`)).toBe(id)
    })

    it("accepts uppercase UUIDs in an absolute return URL and keeps their spelling", () => {
        const upper = "ABCDEF01-2345-6789-ABCD-EF0123456789"

        expect(connectionIdOfReturn(`https://nivo.vn/connections?id=${upper}&connect=meta`)).toBe(upper)
    })

    it.each([
        "/connections?connect=meta",
        "/connections?id=",
        "/connections?id=not-a-uuid",
        "/connections?id=01234567-89ab-cdef-0123-456789abcdeg",
        "/connections?id=01234567-89ab-cdef-0123-456789abcdef-extra",
    ])("answers null for a return path without a valid connection id: %s", (returnTo) => {
        expect(connectionIdOfReturn(returnTo)).toBeNull()
    })
})
