import { Test } from "@nestjs/testing"
import { connectionIdOfReturn, parseMetaSecret } from "./meta-secret.policy"

const SUBJECT = Symbol("meta-secret.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseMetaSecret, connectionIdOfReturn } }],
    }).compile()
    return moduleRef.get<typeof import("./meta-secret.policy")>(SUBJECT)
}

describe("parseMetaSecret", () => {
    it("reads the Page, user and Instagram credentials without changing their values", async () => {
        const subject = await buildSubject()

        const secret = {
            userToken: "user-token",
            pageToken: "page-token",
            pageId: "PAGE-1",
            igId: "IG-1",
        }

        expect(subject.parseMetaSecret(JSON.stringify(secret))).toEqual(secret)
        expect(subject.parseMetaSecret("{}")).toEqual({})
    })

    it.each(["not json", "", "null", "[]", '["page-token"]', '"page-token"', "1", "true"])(
        "treats %j as an empty credential",
        async (plain) => {
            const subject = await buildSubject()

            expect(subject.parseMetaSecret(plain)).toEqual({})
        },
    )
})

describe("connectionIdOfReturn", () => {
    const id = "01234567-89ab-cdef-0123-456789abcdef"

    it("reads a UUID from a relative callback return path", async () => {
        const subject = await buildSubject()

        expect(subject.connectionIdOfReturn(`/connections?connect=meta&id=${id}`)).toBe(id)
    })

    it("accepts uppercase UUIDs in an absolute return URL and keeps their spelling", async () => {
        const subject = await buildSubject()

        const upper = "ABCDEF01-2345-6789-ABCD-EF0123456789"

        expect(subject.connectionIdOfReturn(`https://nivo.vn/connections?id=${upper}&connect=meta`)).toBe(upper)
    })

    it("ignores fragments and decodes the query of a relative return path", async () => {
        const subject = await buildSubject()

        expect(subject.connectionIdOfReturn(`/connections?id=${encodeURIComponent(id)}#id=invalid`)).toBe(id)
        expect(subject.connectionIdOfReturn(`/connections#id=${id}`)).toBeNull()
    })

    it.each([
        "/connections?connect=meta",
        "/connections?id=",
        "/connections?id=not-a-uuid",
        "/connections?id=01234567-89ab-cdef-0123-456789abcdeg",
        "/connections?id=01234567-89ab-cdef-0123-456789abcdef-extra",
    ])("answers null for a return path without a valid connection id: %s", async (returnTo) => {
        const subject = await buildSubject()

        expect(subject.connectionIdOfReturn(returnTo)).toBeNull()
    })
})
