import { Test } from "@nestjs/testing"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { bankFactsOf, filled, invalidSeed, oaSecretOf, payosKeysOf, sepayKeyOf } from "./channel-seed.policy"

const SUBJECT = Symbol("./channel-seed.policy")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { bankFactsOf, filled, invalidSeed, oaSecretOf, payosKeysOf, sepayKeyOf } },
        ],
    }).compile()
    return moduleRef.get<typeof import("./channel-seed.policy")>(SUBJECT)
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

describe("oaSecretOf", () => {
    it.each([undefined, "", "PENDING-zalo", "  PENDING-until-issued"])("never stores %j", async (value) => {
        const subject = await build()
        expect(subject.oaSecretOf(value)).toBeUndefined()
    })

    it("keeps an OA secret key that was issued", async () => {
        const subject = await build()
        expect(subject.oaSecretOf(" issued-key ")).toBe("issued-key")
        expect(subject.oaSecretOf("a-PENDING-in-the-middle")).toBe("a-PENDING-in-the-middle")
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
