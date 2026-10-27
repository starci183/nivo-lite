import type * as SubjectModule from "./money-provider.policy"
import { Test } from "@nestjs/testing"
import {
    isZaloAppId,
    isMoneyProvider,
    moneyRules,
    chooseEnvironment,
    maskAccount,
    accountFacts,
    squeeze,
    isAccountNumber,
    isSepayKey,
    isTelegramToken,
    clean,
} from "./money-provider.policy"

const SUBJECT = Symbol("money-provider.policy")
type Subject = Pick<
    typeof SubjectModule,
    | "isMoneyProvider"
    | "moneyRules"
    | "chooseEnvironment"
    | "maskAccount"
    | "accountFacts"
    | "squeeze"
    | "isAccountNumber"
    | "isSepayKey"
    | "isTelegramToken"
    | "isZaloAppId"
    | "clean"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isMoneyProvider,
                    moneyRules,
                    chooseEnvironment,
                    maskAccount,
                    accountFacts,
                    squeeze,
                    isAccountNumber,
                    isSepayKey,
                    isTelegramToken,
                    isZaloAppId,
                    clean,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("isZaloAppId", () => {
    it("accepts six to thirty digits and refuses other app identifiers", async () => {
        const subject = await buildSubject()

        expect(subject.isZaloAppId("123456")).toBe(true)
        expect(subject.isZaloAppId("1".repeat(30))).toBe(true)
        expect(subject.isZaloAppId("12345")).toBe(false)
        expect(subject.isZaloAppId("1".repeat(31))).toBe(false)
        expect(subject.isZaloAppId("app123456")).toBe(false)
    })
})

describe("accountFacts", () => {
    it("stores the full account number next to its masked form", async () => {
        const subject = await buildSubject()

        expect(subject.accountFacts("0123456789")).toEqual({
            account_masked: subject.maskAccount("0123456789"),
            account_number: "0123456789",
        })
        expect(subject.accountFacts("0123456789").account_masked).toMatch(/ 6789$/u)
    })
})

describe("isAccountNumber", () => {
    it("accepts 6 to 20 digits only", async () => {
        const subject = await buildSubject()

        expect(subject.isAccountNumber("123456")).toBe(true)
        expect(subject.isAccountNumber("1".repeat(20))).toBe(true)
        expect(subject.isAccountNumber("12345")).toBe(false)
        expect(subject.isAccountNumber("1".repeat(21))).toBe(false)
        expect(subject.isAccountNumber("12 3456")).toBe(false)
        expect(subject.isAccountNumber("12345a")).toBe(false)
    })
})
