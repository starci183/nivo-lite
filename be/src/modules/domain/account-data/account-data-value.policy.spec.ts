import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import {
    accountKeyOf,
    checkedRowOf,
    isForward,
    occurredAtOf,
    positionOf,
    rowValuesOf,
    schemaOf,
    secretMemberOf,
    valueBytesOf,
} from "./account-data-value.policy"
import { defineAccountDataType } from "./define-account-data-type.policy"
import { AccountDataErrorCode } from "./errors/account-data.error"

const SUBJECT = Symbol("account-data-value.policy")

const build = async (): Promise<typeof import("./account-data-value.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    accountKeyOf,
                    checkedRowOf,
                    isForward,
                    occurredAtOf,
                    positionOf,
                    rowValuesOf,
                    schemaOf,
                    secretMemberOf,
                    valueBytesOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./account-data-value.policy")>(SUBJECT)
}

const message = defineAccountDataType({
    name: "telegram.message",
    provider: "telegram",
    version: 2,
    write: "append",
    fields: {
        chatId: { type: "text", required: true, maxLength: 40 },
        messageId: { type: "integer", required: true },
        username: { type: "text", required: false, maxLength: 5 },
        score: { type: "number", required: false },
        bot: { type: "boolean", required: false },
        at: { type: "timestamp", required: true },
        raw: { type: "json", required: true },
    },
    key: ["chatId", "messageId"],
    occurredAt: "at",
    maxBytes: 300,
    retention: "keep",
    secretFields: ["bot_token"],
})

const cursor = defineAccountDataType({
    name: "imap.read-cursor",
    provider: "imap",
    version: 1,
    write: "advance",
    fields: { agentId: { type: "text", required: true }, seenThrough: { type: "text", required: true } },
    key: ["agentId"],
    position: "seenThrough",
    retention: "keep",
})

/** What a call threw, or undefined when it threw nothing. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
        return undefined
    } catch (error) {
        return error
    }
}

const VALUE = { chatId: "-100", messageId: 7, at: "2026-11-12T03:00:00.000+07:00", raw: { text: "hi" } }

const invalid = (members: string) => ({
    code: AccountDataErrorCode.ValueInvalid,
    params: { type: "telegram.message", members },
})

describe("schemaOf", () => {
    let policy: typeof import("./account-data-value.policy")

    beforeAll(async () => {
        policy = await build()
    })

    const schema = () => policy.schemaOf(message)

    it("takes exactly the declared members, each of its type, and builds the schema once per declaration", () => {
        expect(schema().safeParse({ ...VALUE, username: "lan", score: 1.5, bot: false }).success).toBe(true)
        expect(policy.schemaOf(message)).toBe(schema())
    })

    it.each<[string, object]>([
        ["a member the type does not declare", { ...VALUE, extra: 1 }],
        ["a required member that is absent", { chatId: "-100", messageId: 7, at: VALUE.at }],
        ["an optional member that is null", { ...VALUE, username: null }],
        ["a text over its maxLength", { ...VALUE, username: "toolong" }],
        ["an integer with a fraction", { ...VALUE, messageId: 7.5 }],
        ["a number that is text", { ...VALUE, score: "1" }],
        ["a boolean that is a number", { ...VALUE, bot: 1 }],
        ["a timestamp without an offset", { ...VALUE, at: "2026-11-12T03:00:00" }],
        ["a timestamp that does not parse", { ...VALUE, at: "2026-13-45T99:99:99Z" }],
        ["a json member that is null", { ...VALUE, raw: null }],
    ])("refuses %s", (_case, value) => {
        expect(schema().safeParse(value).success).toBe(false)
    })

    it("takes any JSON value but null in a json member, nested nulls included", () => {
        expect(schema().safeParse({ ...VALUE, raw: [1, "a", { deep: null }] }).success).toBe(true)
        expect(schema().safeParse({ ...VALUE, raw: "text" }).success).toBe(true)
    })
})

describe("accountKeyOf", () => {
    let policy: typeof import("./account-data-value.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("joins the declared key members' values by a colon, an integer in decimal", () => {
        expect(policy.accountKeyOf(message, VALUE)).toBe("-100:7")
    })

    it("hashes a key longer than 400 characters as sha256:<hex>", () => {
        const chatId = "c".repeat(401)
        const hex = createHash("sha256").update(`${chatId}:7`).digest("hex")

        expect(policy.accountKeyOf(message, { ...VALUE, chatId })).toBe(`sha256:${hex}`)
    })

    it.each<[string, Record<string, unknown>, string]>([
        ["an empty text", { ...VALUE, chatId: "" }, "chatId"],
        ["a fraction", { ...VALUE, messageId: 1.5 }, "messageId"],
        ["a missing member", { chatId: "-100" }, "messageId"],
        ["an object", { ...VALUE, chatId: { id: 1 } }, "chatId"],
    ])("refuses %s as a key part (VALUE_INVALID)", (_case, value, member) => {
        expect(thrownBy(() => policy.accountKeyOf(message, value))).toMatchObject(invalid(member))
    })
})

describe("secretMemberOf", () => {
    let policy: typeof import("./account-data-value.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("finds a secret member NAME at any depth, inside arrays too", () => {
        expect(policy.secretMemberOf({ a: [{ b: { c: [{ bot_token: "x" }] } }] }, ["bot_token"])).toBe("bot_token")
    })

    it("answers null when no member has the name, for a value of scalars, and when the type names no secret", () => {
        expect(policy.secretMemberOf({ a: [{ b: "bot_token" }], c: null }, ["bot_token"])).toBeNull()
        expect(policy.secretMemberOf("bot_token", ["bot_token"])).toBeNull()
        expect(policy.secretMemberOf({ bot_token: "x" }, [])).toBeNull()
    })
})

describe("checkedRowOf", () => {
    let policy: typeof import("./account-data-value.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("answers the parsed value, its key and its time", () => {
        expect(policy.checkedRowOf(message, VALUE)).toEqual({
            def: message,
            value: VALUE,
            key: "-100:7",
            occurredAt: new Date("2026-11-12T03:00:00.000+07:00"),
        })
    })

    it("refuses a value that does not fit, naming the members and never their content", () => {
        expect(
            thrownBy(() => policy.checkedRowOf(message, { ...VALUE, messageId: "seven", extra: true })),
        ).toMatchObject({
            code: AccountDataErrorCode.ValueInvalid,
            params: { type: "telegram.message", members: "messageId, (value)" },
        })
    })

    it("refuses a secret member nested deep (SECRET_IN_VALUE)", () => {
        expect(
            thrownBy(() =>
                policy.checkedRowOf(message, { ...VALUE, raw: { from: { auth: [{ bot_token: "123:abc" }] } } }),
            ),
        ).toMatchObject({
            code: AccountDataErrorCode.SecretInValue,
            params: { type: "telegram.message", member: "bot_token" },
        })
    })

    it("refuses a value larger than the declared bytes (VALUE_TOO_LARGE)", () => {
        expect(
            thrownBy(() => policy.checkedRowOf(message, { ...VALUE, raw: { text: "x".repeat(300) } })),
        ).toMatchObject({
            code: AccountDataErrorCode.ValueTooLarge,
            params: { type: "telegram.message", maxBytes: 300 },
        })
    })

    it("measures bytes of the JSON text, not characters", () => {
        expect(policy.valueBytesOf({ t: String.fromCodePoint(0x1e_c7) })).toBe(11)
    })
})

describe("rowValuesOf and occurredAtOf", () => {
    let policy: typeof import("./account-data-value.policy")

    beforeAll(async () => {
        policy = await build()
    })

    const owner = { provider: "telegram", connectionId: "c1", workspaceId: "w1" }

    it("writes the declared version and the value's time; the database clock when the type declares none", () => {
        expect(policy.rowValuesOf(owner, policy.checkedRowOf(message, VALUE))).toEqual({
            type: "telegram.message",
            typeVersion: 2,
            ...owner,
            key: "-100:7",
            value: VALUE,
            occurredAt: new Date("2026-11-12T03:00:00.000+07:00"),
        })
        expect(
            policy.rowValuesOf(owner, policy.checkedRowOf(cursor, { agentId: "a1", seenThrough: "x" })),
        ).not.toHaveProperty("occurredAt")
        expect(policy.occurredAtOf(cursor, { agentId: "a1" })).toBeUndefined()
    })
})

describe("positionOf and isForward", () => {
    let policy: typeof import("./account-data-value.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("reads the position member of an advance value", () => {
        expect(policy.positionOf(cursor, { agentId: "a1", seenThrough: "b" })).toBe("b")
        expect(thrownBy(() => policy.positionOf(cursor, { agentId: "a1" }))).toMatchObject({
            code: AccountDataErrorCode.ValueInvalid,
        })
        expect(thrownBy(() => policy.positionOf(message, VALUE))).toMatchObject({
            code: AccountDataErrorCode.ValueInvalid,
        })
    })

    it("compares texts by code unit and numbers numerically; equal, backward and mixed are never forward", () => {
        expect(policy.isForward("b", "a")).toBe(true)
        expect(policy.isForward("10", "9")).toBe(false)
        expect(policy.isForward(10, 9)).toBe(true)
        expect(policy.isForward(9, 9)).toBe(false)
        expect(policy.isForward("a", "a")).toBe(false)
        expect(policy.isForward(10, "9")).toBe(false)
    })
})
