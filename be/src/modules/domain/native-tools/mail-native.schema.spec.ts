import { MAIL_GET_INPUT_SCHEMA, MAIL_GET_SCHEMA, MAIL_LIST_INPUT_SCHEMA, MAIL_LIST_SCHEMA } from "./mail-native.schema"

const BOX = "8f8f2c1e-0000-4000-8000-000000000001"

describe("mail tool arguments", () => {
    it("bounds a list page and lets a point be given only with its mailbox", () => {
        expect(MAIL_LIST_SCHEMA.parse({})).toEqual({ limit: 10 })
        expect(MAIL_LIST_SCHEMA.safeParse({ mailbox: BOX, after: "t~x", limit: 25 }).success).toBe(true)
        expect(MAIL_LIST_SCHEMA.safeParse({ after: "t~x" }).success).toBe(false)
        expect(MAIL_LIST_SCHEMA.safeParse({ limit: 26 }).success).toBe(false)
        expect(MAIL_LIST_SCHEMA.safeParse({ mailbox: "support" }).success).toBe(false)
        expect(MAIL_LIST_SCHEMA.safeParse({ folder: "INBOX" }).success).toBe(false)
    })

    it("reads one mail by its uuid, its text bounded", () => {
        expect(MAIL_GET_SCHEMA.parse({ id: BOX })).toEqual({ id: BOX, maxChars: 4000 })
        expect(MAIL_GET_SCHEMA.safeParse({ id: BOX, maxChars: 12_001 }).success).toBe(false)
        expect(MAIL_GET_SCHEMA.safeParse({ id: BOX, markRead: true }).success).toBe(false)
    })

    it("announces both contracts generated from their validators", () => {
        expect(MAIL_LIST_INPUT_SCHEMA).toMatchObject({ type: "object", additionalProperties: false })
        expect(Object.keys(MAIL_LIST_INPUT_SCHEMA.properties ?? {})).toEqual(["mailbox", "after", "limit"])
        expect(MAIL_GET_INPUT_SCHEMA).toMatchObject({ type: "object", required: ["id"] })
    })
})
