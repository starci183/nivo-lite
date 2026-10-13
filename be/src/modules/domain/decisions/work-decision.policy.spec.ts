import { builder } from "@starci/jest-preset"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { BASIS_MIN_CHARS, assigneeOf, basisMissing, cleanBasis, deciderOf, decisionNote } from "./work-decision.policy"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})

describe("work decision policy", () => {
    it("records owner and manager as owner and staff as staff", () => {
        expect(deciderOf(memberOf())).toEqual({ name: "An", kind: "owner" })
        expect(deciderOf(memberOf({ role: "manager" }))).toEqual({ name: "An", kind: "owner" })
        expect(deciderOf(memberOf({ role: "staff" }))).toEqual({ name: "An", kind: "staff" })
    })

    it("reads the assignee of an item", () => {
        const item = { assigned_staff_id: null }
        expect(assigneeOf(item)).toEqual({ assigneeKind: null, assigneeId: null })
        expect(assigneeOf({ assigned_staff_id: "staff-1" })).toEqual({
            assigneeKind: "staff",
            assigneeId: "staff-1",
        })
    })

    it("collapses the spaces of a basis and treats none as empty", () => {
        expect(cleanBasis("  customer   sent a \n screenshot ")).toBe("customer sent a screenshot")
        expect(cleanBasis(null)).toBe("")
    })

    it("asks for a basis only on a payment reconciliation and only when it is short", () => {
        expect(basisMissing("reconcile_payment", "short")).toBe(true)
        expect(basisMissing("reconcile_payment", "x".repeat(BASIS_MIN_CHARS))).toBe(false)
        expect(basisMissing("send_follow_up", "")).toBe(false)
    })

    it("joins the basis line and the note, and answers null when neither exists", () => {
        expect(decisionNote("Basis: a", " ok ")).toBe("Basis: a · ok")
        expect(decisionNote("Basis: a", null)).toBe("Basis: a")
        expect(decisionNote("", "ok")).toBe("ok")
        expect(decisionNote("", "  ")).toBeNull()
        expect(decisionNote("", null)).toBeNull()
    })
})
