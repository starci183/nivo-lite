import { Test } from "@nestjs/testing"

import { builder } from "@starci/jest-preset"

import type { WorkspaceMember } from "@modules/domain/workspace-members"

import {
    BASIS_MIN_CHARS,
    assigneeOf as realAssigneeOf,
    basisMissing as realBasisMissing,
    cleanBasis as realCleanBasis,
    deciderOf as realDeciderOf,
    decisionNote as realDecisionNote,
} from "./work-decision.policy"

const SUBJECT = Symbol("work-decision.policy")

const functions = {
    assigneeOf: realAssigneeOf,
    basisMissing: realBasisMissing,
    cleanBasis: realCleanBasis,
    deciderOf: realDeciderOf,
    decisionNote: realDecisionNote,
}

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    assigneeOf: realAssigneeOf,
                    basisMissing: realBasisMissing,
                    cleanBasis: realCleanBasis,
                    deciderOf: realDeciderOf,
                    decisionNote: realDecisionNote,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<typeof functions>(SUBJECT)

    return { subject }
}

describe("work decision policy", () => {
    it("records owner and manager as owner and staff as staff", async () => {
        const { subject } = await buildSubject()

        expect(subject.deciderOf(memberOf())).toEqual({ name: "An", kind: "owner" })
        expect(subject.deciderOf(memberOf({ role: "manager" }))).toEqual({ name: "An", kind: "owner" })
        expect(subject.deciderOf(memberOf({ role: "staff" }))).toEqual({ name: "An", kind: "staff" })
    })

    it("reads the assignee of an item", async () => {
        const { subject } = await buildSubject()

        const item = { assigned_staff_id: null }
        expect(subject.assigneeOf(item)).toEqual({ assigneeKind: null, assigneeId: null })
        expect(subject.assigneeOf({ assigned_staff_id: "staff-1" })).toEqual({
            assigneeKind: "staff",
            assigneeId: "staff-1",
        })
    })

    it("collapses the spaces of a basis and treats none as empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.cleanBasis("  customer   sent a \n screenshot ")).toBe("customer sent a screenshot")
        expect(subject.cleanBasis(null)).toBe("")
    })

    it("asks for a basis only on a payment reconciliation and only when it is short", async () => {
        const { subject } = await buildSubject()

        expect(subject.basisMissing("reconcile_payment", "short")).toBe(true)
        expect(subject.basisMissing("reconcile_payment", "x".repeat(BASIS_MIN_CHARS))).toBe(false)
        expect(subject.basisMissing("send_follow_up", "")).toBe(false)
    })

    it("joins the basis line and the note, and answers null when neither exists", async () => {
        const { subject } = await buildSubject()

        expect(subject.decisionNote("Basis: a", " ok ")).toBe("Basis: a · ok")
        expect(subject.decisionNote("Basis: a", null)).toBe("Basis: a")
        expect(subject.decisionNote("", "ok")).toBe("ok")
        expect(subject.decisionNote("", "  ")).toBeNull()
        expect(subject.decisionNote("", null)).toBeNull()
    })
})
