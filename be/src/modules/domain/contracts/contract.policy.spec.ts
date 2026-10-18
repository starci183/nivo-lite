import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { ContractsErrorCode } from "./errors/contracts.error"
import { checkContract, isIsoDay } from "./contract.policy"
import type { ContractDraft } from "./contract.policy"

const SUBJECT = Symbol("contract.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isIsoDay, checkContract } }],
    }).compile()
    return moduleRef.get<typeof import("./contract.policy")>(SUBJECT)
}

const draftOf = builder<ContractDraft>({
    customerName: "  Anh Minh  ",
    plan: " Monthly ",
    startsOn: "2026-10-01",
    endsOn: "2027-09-30",
    amountVnd: 5_000_000,
    status: "active",
    note: " renew in September ",
})

describe("sales contract policy", () => {
    describe("isIsoDay", () => {
        it("accepts a real calendar day", async () => {
            const subject = await buildSubject()

            expect(subject.isIsoDay("2026-02-28")).toBe(true)
        })

        it.each(["2026-02-30", "31/10/2026", "2026-13-45"])("refuses invalid calendar day %s", async (value) => {
            const subject = await buildSubject()
            expect(subject.isIsoDay(value)).toBe(false)
        })
    })
})

describe("sales contract policy", () => {
    describe("checkContract", () => {
        it("answers the contract trimmed", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf())).toEqual({
                kind: "ok",
                value: {
                    customerName: "Anh Minh",
                    plan: "Monthly",
                    startsOn: "2026-10-01",
                    endsOn: "2027-09-30",
                    amountVnd: 5_000_000,
                    status: "active",
                    note: "renew in September",
                },
            })
        })
        it("bounds the customer name, the plan and the note", async () => {
            const subject = await buildSubject()
            const verdict = subject.checkContract(
                draftOf({ customerName: "c".repeat(200), plan: "p".repeat(200), note: "n".repeat(900) }),
            )
            expect(verdict).toMatchObject({
                kind: "ok",
                value: { customerName: "c".repeat(120), plan: "p".repeat(120), note: "n".repeat(500) },
            })
        })
        it("accepts a contract with no agreed amount and a one-day term", async () => {
            const subject = await buildSubject()
            expect(
                subject.checkContract(draftOf({ amountVnd: null, endsOn: "2026-10-01" })),
            ).toMatchObject({ kind: "ok" })
        })
        it("refuses a blank customer name", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf({ customerName: "   " }))).toEqual({
                kind: "refused",
                code: ContractsErrorCode.CustomerRequired,
            })
        })
        it("refuses a start that is not a real day", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf({ startsOn: "tomorrow" }))).toMatchObject({
                code: ContractsErrorCode.DateInvalid,
            })
        })
        it("refuses an end that is not a real day", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf({ endsOn: "2026-02-30" }))).toMatchObject({
                code: ContractsErrorCode.DateInvalid,
            })
        })
        it("refuses an end before the start", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf({ startsOn: "2026-10-02", endsOn: "2026-10-01" }))).toMatchObject({
                code: ContractsErrorCode.DatesReversed,
            })
        })
        it("refuses a status outside the known ones and names them", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf({ status: "paused" }))).toEqual({
                kind: "refused",
                code: ContractsErrorCode.StatusInvalid,
                params: { list: "active, ended, cancelled" },
            })
        })
        it("refuses a negative amount", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf({ amountVnd: -1 }))).toMatchObject({
                code: ContractsErrorCode.AmountInvalid,
            })
        })
        it("refuses an amount that is not a finite number", async () => {
            const subject = await buildSubject()
            expect(subject.checkContract(draftOf({ amountVnd: Number.NaN }))).toMatchObject({
                code: ContractsErrorCode.AmountInvalid,
            })
        })
    })
})
