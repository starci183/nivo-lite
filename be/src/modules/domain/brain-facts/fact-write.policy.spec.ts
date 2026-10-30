import { Test } from "@nestjs/testing"
import type { FactChanges } from "./fact-columns.policy"
import * as policyModule from "./fact-write.policy"

type Policy = typeof policyModule

const SUBJECT = Symbol("fact-write.policy")

const build = async (): Promise<Policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: policyModule }],
    }).compile()
    return moduleRef.get<Policy>(SUBJECT)
}

let policy: Policy

beforeAll(async () => {
    policy = await build()
})

const isInstant = (value: unknown): value is () => unknown => typeof value === "function"

/** Resolves the SQL of every instant-valued change, so a comparison reads plain values. */
const resolved = (changes: FactChanges): Record<string, unknown> =>
    Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, isInstant(value) ? value() : value]))

describe("fact-write.policy decisionOf", () => {
    it("stamps the decision now with the note and who decided", () => {
        expect(resolved(policy.decisionOf("rejected", "wrong price", "user-1"))).toEqual({
            status: "rejected",
            decidedBy: "user-1",
            decidedAt: "now()",
            decisionNote: "wrong price",
            updatedAt: "now()",
        })
    })

    it("leaves decidedBy out when nobody decided", () => {
        const changes = resolved(policy.decisionOf("expired", null))

        expect(changes).toEqual({
            status: "expired",
            decidedAt: "now()",
            decisionNote: null,
            updatedAt: "now()",
        })
        expect("decidedBy" in changes).toBe(false)
    })
})

describe("fact-write.policy scheduleChanges", () => {
    it("approves the proposal as scheduled after the current value", () => {
        expect(resolved(policy.scheduleChanges("fact-0", "user-1", "next season"))).toEqual({
            status: "scheduled",
            supersedesId: "fact-0",
            conflictWith: null,
            decidedBy: "user-1",
            decidedAt: "now()",
            decisionNote: "next season",
            updatedAt: "now()",
        })
    })

    it("follows no value when there is none in force", () => {
        expect(resolved(policy.scheduleChanges(null, "user-1", null))).toMatchObject({
            supersedesId: null,
            decisionNote: null,
        })
    })
})

describe("fact-write.policy activateChanges", () => {
    it("approves the proposal as the value in force from its own start or now", () => {
        expect(resolved(policy.activateChanges("fact-0", "user-1", "confirmed"))).toEqual({
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

    it("replaces nothing when there is no current value", () => {
        expect(resolved(policy.activateChanges(null, "user-1", null))).toMatchObject({
            supersedesId: null,
            decisionNote: null,
        })
    })
})

describe("fact-write.policy SUPERSEDE", () => {
    it("closes the value in force as history", () => {
        expect(resolved(policy.SUPERSEDE)).toEqual({
            status: "superseded",
            validTo: "coalesce(valid_to, now())",
            updatedAt: "now()",
        })
    })
})
