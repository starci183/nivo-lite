import { Test } from "@nestjs/testing"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { defineAccountDataType, typeProblemsOf } from "./define-account-data-type.policy"
import { AccountDataErrorCode } from "./errors/account-data.error"

const SUBJECT = Symbol("define-account-data-type.policy")

/** The policy as Nest provides it. */
type Policy = typeof import("./define-account-data-type.policy")

const build = async (): Promise<Pick<Policy, "defineAccountDataType" | "typeProblemsOf">> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { defineAccountDataType, typeProblemsOf } }],
    }).compile()
    return moduleRef.get<Pick<Policy, "defineAccountDataType" | "typeProblemsOf">>(SUBJECT)
}

/** What a call threw, or undefined when it threw nothing. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
        return undefined
    } catch (error) {
        return error
    }
}

/** A sound declaration every case below breaks in one way. */
const SOUND: AccountDataTypeDef = {
    name: "telegram.message",
    provider: "telegram",
    version: 1,
    write: "append",
    fields: {
        chatId: { type: "text", required: true, maxLength: 40 },
        messageId: { type: "integer", required: true },
        username: { type: "text", required: false, maxLength: 64 },
        at: { type: "timestamp", required: true },
        raw: { type: "json", required: true },
    },
    key: ["chatId", "messageId"],
    occurredAt: "at",
    position: undefined,
    ttlMs: undefined,
    maxBytes: 64_000,
    wakes: true,
    retention: { days: 30 },
    indexes: [{ name: "username", on: ["username"] }],
    secretFields: ["bot_token"],
    purpose: "chat.event",
}

const with_ = (changes: Partial<AccountDataTypeDef>): AccountDataTypeDef => ({ ...SOUND, ...changes })

describe("defineAccountDataType", () => {
    let policy: Pick<Policy, "defineAccountDataType" | "typeProblemsOf">

    beforeAll(async () => {
        policy = await build()
    })

    it("answers a sound declaration itself", () => {
        expect(policy.defineAccountDataType(SOUND)).toBe(SOUND)
        expect(policy.typeProblemsOf(SOUND)).toEqual([])
    })

    it("takes a provider-null type of any prefix, an advance type with its position, and an overwrite type with a ttl", () => {
        expect(
            policy.typeProblemsOf(
                with_({
                    name: "interface.snapshot",
                    provider: null,
                    write: "overwrite",
                    ttlMs: 60_000,
                    wakes: undefined,
                    key: ["chatId"],
                }),
            ),
        ).toEqual([])
        expect(
            policy.typeProblemsOf(
                with_({
                    name: "telegram.read-cursor",
                    write: "advance",
                    position: "messageId",
                    wakes: false,
                    key: ["chatId"],
                }),
            ),
        ).toEqual([])
    })

    it("refuses a declaration that breaks its rules, with TYPE_INVALID naming every rule", () => {
        expect(
            thrownBy(() => policy.defineAccountDataType(with_({ name: "Telegram.Message", version: 0 }))),
        ).toMatchObject({
            code: AccountDataErrorCode.TypeInvalid,
            params: {
                type: "Telegram.Message",
                problems:
                    "name: not <provider>.<name> of at most 50 characters; name: the prefix is not the provider; version: not a whole number of at least 1",
            },
        })
    })
})

describe("defineAccountDataType refusals", () => {
    let policy: Pick<Policy, "defineAccountDataType" | "typeProblemsOf">

    beforeAll(async () => {
        policy = await build()
    })

    it.each<[string, Partial<AccountDataTypeDef>, string]>([
        ["a name without a dot", { name: "telegram" }, "name: not <provider>.<name>"],
        ["a name too long for its partition", { name: `telegram.${"a".repeat(45)}` }, "name: not <provider>.<name>"],
        ["a prefix that is not the provider", { name: "zalo_oa.message" }, "name: the prefix is not the provider"],
        ["a provider of the wrong form", { provider: "Tele gram" }, "provider: not a provider name"],
        ["a version below 1", { version: 0 }, "version: not a whole number"],
        ["no field", { fields: {}, key: [], occurredAt: undefined, indexes: [] }, "fields: none declared"],
        [
            "a field name that is no plain word",
            { fields: { ...SOUND.fields, "bad-name": { type: "text", required: false } } },
            "field bad-name: the name is not a plain word",
        ],
        [
            "maxLength on a non-text field",
            { fields: { ...SOUND.fields, count: { type: "integer", required: false, maxLength: 3 } } },
            "field count: maxLength only on text",
        ],
        [
            "a maxLength below 1",
            { fields: { ...SOUND.fields, note: { type: "text", required: false, maxLength: 0 } } },
            "field note: maxLength is not a whole number",
        ],
        ["an empty key", { key: [] }, "key: names no field"],
        ["a key naming a field twice", { key: ["chatId", "chatId"] }, "key: names a field twice"],
        ["a key that is no field", { key: ["nope"] }, "key nope: no such field"],
        ["a key of a json field", { key: ["raw"] }, "key raw: must be text or integer"],
        ["an optional key field", { key: ["username"] }, "key username: must be required"],
        ["an occurredAt that is not a timestamp", { occurredAt: "chatId" }, "occurredAt chatId: must be timestamp"],
    ])("refuses %s", (_case, changes, problem) => {
        expect(policy.typeProblemsOf(with_(changes)).some((found) => found.startsWith(problem))).toBe(true)
    })
})

describe("defineAccountDataType refusals of modes and indexes", () => {
    let policy: Pick<Policy, "defineAccountDataType" | "typeProblemsOf">

    beforeAll(async () => {
        policy = await build()
    })

    it.each<[string, Partial<AccountDataTypeDef>, string]>([
        ["advance without a position", { write: "advance", wakes: false }, "position: required by advance"],
        ["a position outside advance", { position: "messageId" }, "position: only with advance"],
        ["a ttl outside overwrite", { ttlMs: 1000 }, "ttlMs: only with overwrite"],
        ["a ttl below 1", { write: "overwrite", wakes: false, ttlMs: 0 }, "ttlMs: not a whole number"],
        ["wakes outside append", { write: "overwrite" }, "wakes: only with append"],
        ["a maxBytes below 1", { maxBytes: 0 }, "maxBytes: not a whole number"],
        ["a retention of 0 days", { retention: { days: 0 } }, "retention: keep, or 1 to 3650 days"],
        [
            "five indexes",
            { indexes: ["a", "b", "c", "d", "e"].map((name) => ({ name, on: ["chatId"] })) },
            "indexes: more than 4",
        ],
        [
            "two indexes of one name",
            {
                indexes: [
                    { name: "chat", on: ["chatId"] },
                    { name: "chat", on: ["at"] },
                ],
            },
            "indexes: two indexes share a name",
        ],
        [
            "an index name not in snake case",
            { indexes: [{ name: "ChatId", on: ["chatId"] }] },
            "index ChatId: the name is not lower-case snake",
        ],
        [
            "an index of three fields",
            { indexes: [{ name: "wide", on: ["chatId", "messageId", "at"] }] },
            "index wide: names 1 to 2 fields",
        ],
        [
            "an index of a json field",
            { indexes: [{ name: "raw", on: ["raw"] }] },
            "index raw raw: must be text or integer or number or boolean or timestamp",
        ],
        [
            "a secret name that is a declared field",
            { secretFields: ["chatId"] },
            "secretFields: chatId is a declared field",
        ],
        ["an empty secret name", { secretFields: [""] }, "secretFields: an empty name"],
    ])("refuses %s", (_case, changes, problem) => {
        expect(policy.typeProblemsOf(with_(changes)).some((found) => found.startsWith(problem))).toBe(true)
    })
})

describe("defineAccountDataType refusals of names and kinds", () => {
    let policy: Pick<Policy, "defineAccountDataType" | "typeProblemsOf">

    beforeAll(async () => {
        policy = await build()
    })

    it("refuses two field names that give the same CHECK name", () => {
        expect(
            policy.typeProblemsOf(
                with_({
                    fields: { ...SOUND.fields, chat_id: { type: "text", required: false } },
                }),
            ),
        ).toContain("fields: two names give the same CHECK name")
    })

    it("refuses an unknown write mode and an unknown field type", () => {
        const odd = Object.assign({ type: "text", required: false } as const, { type: "date" })
        const loose = Object.assign(structuredClone(SOUND), { write: "merge", fields: { ...SOUND.fields, odd } })

        const problems = policy.typeProblemsOf(loose)

        expect(problems).toContain("write: unknown mode")
        expect(problems).toContain("field odd: unknown type")
    })
})
