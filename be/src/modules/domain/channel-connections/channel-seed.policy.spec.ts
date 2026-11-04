import { Test } from "@nestjs/testing"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import {
    bankFactsOf,
    filled,
    googleClientOf,
    invalidSeed,
    issuedOf,
    payosKeysOf,
    sepayKeyOf,
} from "./channel-seed.policy"

/** The members of the subject under test. */
interface Subject {
    readonly bankFactsOf: typeof bankFactsOf
    readonly filled: typeof filled
    readonly googleClientOf: typeof googleClientOf
    readonly invalidSeed: typeof invalidSeed
    readonly issuedOf: typeof issuedOf
    readonly payosKeysOf: typeof payosKeysOf
    readonly sepayKeyOf: typeof sepayKeyOf
}

const SUBJECT = Symbol("channel-seed.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { bankFactsOf, filled, googleClientOf, invalidSeed, issuedOf, payosKeysOf, sepayKeyOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ID = "44c471c0-1a75-42e2-ac4b-09dded78c263"
const KEY = ["nivo", "ab12".repeat(16)].join("_")
const refused = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

describe("invalidSeed", () => {
    it("refuses with the name of the field and no value", async () => {
        const subject = await build()

        expect(() => subject.invalidSeed("sepay.bank")).toThrow(refused("sepay.bank"))
    })
})

describe("filled", () => {
    it.each([undefined, "", "  \t"])("reads %j as absent", async (value) => {
        const subject = await build()

        expect(subject.filled(value)).toBeUndefined()
    })

    it("trims a value that is there", async () => {
        const subject = await build()

        expect(subject.filled("  value ")).toBe("value")
    })
})

describe("issuedOf", () => {
    it.each([undefined, "", "PENDING-zalo", "  PENDING-until-issued"])("never stores %j", async (value) => {
        const subject = await build()

        expect(subject.issuedOf(value)).toBeUndefined()
    })

    it("keeps a Zalo value that was issued", async () => {
        const subject = await build()

        expect(subject.issuedOf(" issued-key ")).toBe("issued-key")
        expect(subject.issuedOf("a-PENDING-in-the-middle")).toBe("a-PENDING-in-the-middle")
    })
})

describe("bankFactsOf", () => {
    it("makes the public facts of a complete account, as the wizard does", async () => {
        const subject = await build()

        expect(
            subject.bankFactsOf({ id: ID, bankCode: " vcb ", accountNumber: "0123 456 789", holder: "nivo jsc" }),
        ).toEqual({
            bank_code: "VCB",
            account_holder: "NIVO JSC",
            account_masked: "•••• 6789",
            account_number: "0123456789",
        })
    })

    it("makes none when nothing is given", async () => {
        const subject = await build()

        expect(subject.bankFactsOf({ id: ID })).toEqual({})
    })

    it.each([
        ["no holder", { bankCode: "VCB", accountNumber: "0123456789" }],
        ["no bank code", { accountNumber: "0123456789", holder: "NIVO" }],
        ["an account that is not digits", { bankCode: "VCB", accountNumber: "12ab", holder: "NIVO" }],
    ])("refuses %s", async (_name, part) => {
        const subject = await build()

        expect(() => subject.bankFactsOf({ id: ID, ...part })).toThrow(refused("sepay.bank"))
    })
})

describe("sepayKeyOf", () => {
    it("reads a key of the shape NIVO generates and nothing when none is given", async () => {
        const subject = await build()

        expect(subject.sepayKeyOf({ id: ID, apiKey: ` ${KEY} ` })).toBe(KEY)
        expect(subject.sepayKeyOf({ id: ID })).toBeUndefined()
    })

    it("refuses a key that cannot be a SePay key", async () => {
        const subject = await build()

        expect(() => subject.sepayKeyOf({ id: ID, apiKey: "no spaces allowed" })).toThrow(refused("sepay.apiKey"))
    })
})

describe("payosKeysOf", () => {
    it("reads the three keys the wizard stores, trimmed", async () => {
        const subject = await build()

        expect(subject.payosKeysOf({ id: ID, clientId: " c ", apiKey: "a", checksumKey: "k" })).toEqual({
            clientId: "c",
            apiKey: "a",
            checksumKey: "k",
        })
    })

    it("reads none when none is given and refuses a part of them", async () => {
        const subject = await build()

        expect(subject.payosKeysOf({ id: ID })).toBeUndefined()
        expect(() => subject.payosKeysOf({ id: ID, clientId: "c", apiKey: "a" })).toThrow(refused("payos"))
        expect(() => subject.payosKeysOf({ id: ID, clientId: "c", checksumKey: "k" })).toThrow(refused("payos"))
        expect(() => subject.payosKeysOf({ id: ID, apiKey: "a", checksumKey: "k" })).toThrow(refused("payos"))
    })
})

describe("googleClientOf", () => {
    it("reads the OAuth client when both values are given", async () => {
        const subject = await build()

        expect(subject.googleClientOf({ id: ID, clientId: " id.apps.test ", clientSecret: "secret-1" })).toEqual({
            clientId: "id.apps.test",
            clientSecret: "secret-1",
        })
    })

    it.each([[undefined], [{ id: ID }], [{ id: ID, clientId: " ", clientSecret: "" }]])(
        "reads %j as no client, so no connection is seeded",
        async (seed) => {
            const subject = await build()

            expect(subject.googleClientOf(seed)).toBeUndefined()
        },
    )

    it.each([[{ id: ID, clientId: "id.apps.test" }], [{ id: ID, clientSecret: "secret-1" }]])(
        "refuses a part of the client %j by the name of the field",
        async (seed) => {
            const subject = await build()

            expect(() => subject.googleClientOf(seed)).toThrow(refused("google"))
        },
    )
})
