import { Test } from "@nestjs/testing"
import * as policy from "./fact-write.policy"

const SUBJECT = Symbol("fact-write.policy")

const subjectOf = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: policy }],
    }).compile()
    return moduleRef.get<typeof import("./fact-write.policy")>(SUBJECT)
}

/** Resolves the SQL of every instant-valued change, so a comparison reads plain values. */
const resolved = (changes: object): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [key, typeof value === "function" ? value() : value]),
    )

describe("fact-write.policy", () => {
    describe("decisionOf", () => {
        it("stamps the decision now with the note and who decided", async () => {
            const { decisionOf } = await subjectOf()

            expect(resolved(decisionOf("rejected", "wrong price", "user-1"))).toEqual({
                status: "rejected",
                decidedBy: "user-1",
                decidedAt: "now()",
                decisionNote: "wrong price",
                updatedAt: "now()",
            })
        })

        it("leaves decidedBy out when nobody decided", async () => {
            const { decisionOf } = await subjectOf()

            const changes = resolved(decisionOf("expired", null))

            expect(changes).toEqual({
                status: "expired",
                decidedAt: "now()",
                decisionNote: null,
                updatedAt: "now()",
            })
            expect("decidedBy" in changes).toBe(false)
        })
    })

    describe("scheduleChanges", () => {
        it("approves the proposal as scheduled after the current value", async () => {
            const { scheduleChanges } = await subjectOf()

            expect(resolved(scheduleChanges("fact-0", "user-1", "next season"))).toEqual({
                status: "scheduled",
                supersedesId: "fact-0",
                conflictWith: null,
                decidedBy: "user-1",
                decidedAt: "now()",
                decisionNote: "next season",
                updatedAt: "now()",
            })
        })

        it("follows no value when there is none in force", async () => {
            const { scheduleChanges } = await subjectOf()

            expect(resolved(scheduleChanges(null, "user-1", null))).toMatchObject({
                supersedesId: null,
                decisionNote: null,
            })
        })
    })

    describe("activateChanges", () => {
        it("approves the proposal as the value in force from its own start or now", async () => {
            const { activateChanges } = await subjectOf()

            expect(resolved(activateChanges("fact-0", "user-1", "confirmed"))).toEqual({
                status: "active",
                supersedesId: "fact-0",
                conflictWith: null,
                decidedBy: "user-1",
                decidedAt: "now()",
                decisionNote: "confirmed",
                validFrom: "coalesce(valid_from, now())",
                updatedAt: "now()",
            })
        })

        it("replaces nothing when there is no current value", async () => {
            const { activateChanges } = await subjectOf()

            expect(resolved(activateChanges(null, "user-1", null))).toMatchObject({
                supersedesId: null,
                decisionNote: null,
            })
        })
    })

    describe("SUPERSEDE", () => {
        it("closes the value in force as history", async () => {
            const { SUPERSEDE } = await subjectOf()

            expect(resolved(SUPERSEDE)).toEqual({
                status: "superseded",
                validTo: "coalesce(valid_to, now())",
                updatedAt: "now()",
            })
        })
    })
})
