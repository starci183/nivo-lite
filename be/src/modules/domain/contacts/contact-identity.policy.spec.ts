import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { identityKeyText as identityKeyTextSubject, normalIdentityOf as normalIdentityOfSubject, normaliseEmail as normaliseEmailSubject, normalisePhone as normalisePhoneSubject } from "./contact-identity.policy"

const SUBJECT = Symbol("contact-identity.policy")

const build = async (): Promise<{ identityKeyText: typeof identityKeyTextSubject; normalIdentityOf: typeof normalIdentityOfSubject; normaliseEmail: typeof normaliseEmailSubject; normalisePhone: typeof normalisePhoneSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ identityKeyText: typeof identityKeyTextSubject; normalIdentityOf: typeof normalIdentityOfSubject; normaliseEmail: typeof normaliseEmailSubject; normalisePhone: typeof normalisePhoneSubject }>({ identityKeyText: identityKeyTextSubject, normalIdentityOf: normalIdentityOfSubject, normaliseEmail: normaliseEmailSubject, normalisePhone: normalisePhoneSubject }) }],
    }).compile()
    return moduleRef.get<{ identityKeyText: typeof identityKeyTextSubject; normalIdentityOf: typeof normalIdentityOfSubject; normaliseEmail: typeof normaliseEmailSubject; normalisePhone: typeof normalisePhoneSubject }>(SUBJECT)
}

describe("contact-identity.policy: one canonical form per identifier (exact comparison only)", () => {
    let identityKeyText: typeof identityKeyTextSubject
    let normalIdentityOf: typeof normalIdentityOfSubject
    let normaliseEmail: typeof normaliseEmailSubject
    let normalisePhone: typeof normalisePhoneSubject

    beforeAll(async () => {
        ;({ identityKeyText, normalIdentityOf, normaliseEmail, normalisePhone } = await build())
    })

    it.each([
        ["0912 345 678", "84912345678"],
        ["+84 912.345.678", "84912345678"],
        ["0084912345678", "84912345678"],
        ["84912345678", "84912345678"],
        ["912345678", "84912345678"],
        ["(091) 234-5678", "84912345678"],
    ])("writes the phone %s as the Zalo form %s", (raw, canonical) => {
        expect(normalisePhone(raw)).toBe(canonical)
    })

    it.each([["0123"], ["abc"], [""], ["+1 415 555 0100"], ["0212345678"]])("refuses %s as no phone it can compare", (raw) => {
        expect(normalisePhone(raw)).toBeNull()
    })

    it.each([
        ["  Lan@Gmail.COM ", "lan@gmail.com"],
        ["lan@gmail.com", "lan@gmail.com"],
    ])("writes the mail %s trimmed and lower-cased", (raw, canonical) => {
        expect(normaliseEmail(raw)).toBe(canonical)
    })

    it.each([["no-at-sign"], ["@x"], ["a@"], [""], ["two words@x.y"]])("refuses %s as no mail address", (raw) => {
        expect(normaliseEmail(raw)).toBeNull()
    })

    it("keeps a channel's own user id and an outside system's id as given (trimmed), with their channel and account", () => {
        expect(normalIdentityOf({ kind: "channel", provider: "Zalo", account: "conn-1", value: " 4411 ", proof: "channel" })).toEqual({
            kind: "channel",
            provider: "zalo",
            account: "conn-1",
            value: "4411",
            proof: "channel",
        })
        expect(normalIdentityOf({ kind: "external", account: "conn-2", value: "ACME-01", proof: "member" })).toEqual({
            kind: "external",
            provider: "",
            account: "conn-2",
            value: "ACME-01",
            proof: "member",
        })
    })

    it("drops the channel and account of a phone or a mail, and keeps a claim unproven", () => {
        expect(normalIdentityOf({ kind: "phone", provider: "zalo", account: "x", value: "0912345678" })).toEqual({
            kind: "phone",
            provider: "",
            account: "",
            value: "84912345678",
            proof: null,
        })
    })

    it("refuses a channel id without its channel or account, an outside id without its account, and an empty value", () => {
        expect(normalIdentityOf({ kind: "channel", account: "conn-1", value: "1" })).toBeNull()
        expect(normalIdentityOf({ kind: "channel", provider: "zalo", value: "1" })).toBeNull()
        expect(normalIdentityOf({ kind: "external", value: "ACME" })).toBeNull()
        expect(normalIdentityOf({ kind: "external", account: "c", value: "   " })).toBeNull()
    })

    it("keys an identity by kind, channel, account and value: two forms of one phone are one key", () => {
        const a = normalIdentityOf({ kind: "phone", value: "0912 345 678" })
        const b = normalIdentityOf({ kind: "phone", value: "+84912345678" })
        expect(a).not.toBeNull()
        expect(b).not.toBeNull()
        if (a === null || b === null) return
        expect(identityKeyText(a)).toBe(identityKeyText(b))
        expect(identityKeyText(a)).not.toBe(identityKeyText({ ...a, kind: "email" }))
    })
})
