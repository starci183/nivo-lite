import type * as SubjectModule from "./money-provider.policy"
import { Test } from "@nestjs/testing"
import {
    isZaloAppId,
    isMoneyProvider,
    moneyRules,
    chooseEnvironment,
    maskAccount,
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
