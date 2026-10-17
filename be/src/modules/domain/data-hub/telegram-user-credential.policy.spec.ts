import type * as SubjectModule from "./telegram-user-credential.policy"
import { Test } from "@nestjs/testing"
import { LOGIN_TTL_MS, loginExpired, parseCredential, serializeCredential } from "./telegram-user-credential.policy"
import type { TelegramLoginState } from "./telegram-user-wizard.contracts"

const SUBJECT = Symbol("telegram-user-credential.policy")
type Subject = Pick<typeof SubjectModule, "parseCredential" | "serializeCredential" | "loginExpired">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseCredential, serializeCredential, loginExpired } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const login: TelegramLoginState = {
    stage: "code",
    phone: "+84912345678",
    phoneCodeHash: "code-hash",
    session: "temporary-session",
    startedAt: 1_700_000_000_000,
}

describe("parseCredential", () => {
    it.each([null, undefined, "", "{", "null", "[]", "1", '"session"'])(
        "returns an empty credential for absent or broken JSON (%s)",
        async (raw) => {
            const subject = await buildSubject()

            expect(subject.parseCredential(raw)).toEqual({})
        },
    )

    it.each([{}, { session: "" }, { session: 42 }, { login: null }, { login: [] }, { login: "pending" }])(
        "omits unusable sessions and non-object login state (%j)",
        async (value) => {
            const subject = await buildSubject()

            expect(subject.parseCredential(JSON.stringify(value))).toEqual({})
        },
    )

    it.each([
        { ...login, session: 42 },
        { ...login, phone: 42 },
        { ...login, phoneCodeHash: 42 },
    ])("discards login state with a non-string required field (%j)", async (invalidLogin) => {
        const subject = await buildSubject()

        expect(subject.parseCredential(JSON.stringify({ session: "final-session", login: invalidLogin }))).toEqual({
            session: "final-session",
        })
    })

    it("keeps the final session and a complete pending login", async () => {
        const subject = await buildSubject()

        expect(subject.parseCredential(JSON.stringify({ session: "final-session", login }))).toEqual({
            session: "final-session",
            login,
        })
        expect(subject.parseCredential(JSON.stringify({ login: { ...login, stage: "password" } }))).toEqual({
            login: { ...login, stage: "password" },
        })
    })

    it("defaults an unknown stage to code and coerces the start time to a number", async () => {
        const subject = await buildSubject()

        expect(
            subject.parseCredential(JSON.stringify({ login: { ...login, stage: "other", startedAt: "123" } })),
        ).toEqual({
            login: { ...login, startedAt: 123 },
        })
    })

    it.each([undefined, 0, "invalid"])("defaults an unusable start time (%s) to zero", async (startedAt) => {
        const subject = await buildSubject()

        expect(subject.parseCredential(JSON.stringify({ login: { ...login, startedAt } }))).toEqual({
            login: { ...login, startedAt: 0 },
        })
    })
})

describe("serializeCredential", () => {
    it("stores exactly the credential fields as JSON", async () => {
        const subject = await buildSubject()

        expect(subject.serializeCredential({})).toBe("{}")
        expect(subject.serializeCredential({ session: "final-session", login })).toBe(
            '{"session":"final-session","login":{"stage":"code","phone":"+84912345678","phoneCod' +
                'eHash":"code-hash","session":"temporary-session","startedAt":1700000000000}}',
        )
    })
})

describe("loginExpired", () => {
    it("expires strictly after ten minutes", async () => {
        const subject = await buildSubject()

        expect(LOGIN_TTL_MS).toBe(600_000)
        expect(subject.loginExpired(login, login.startedAt)).toBe(false)
        expect(subject.loginExpired(login, login.startedAt + 599_999)).toBe(false)
        expect(subject.loginExpired(login, login.startedAt + 600_000)).toBe(false)
        expect(subject.loginExpired(login, login.startedAt + 600_001)).toBe(true)
    })
})
