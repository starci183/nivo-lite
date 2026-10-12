import { builder } from "@starci/jest-preset"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { admitMember, canDecide, isManagerRole } from "./role.policy"
import type { WorkspaceMember } from "./workspace-members.contracts"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "staff-1",
    displayName: "An",
    status: "active",
})

describe("isManagerRole", () => {
    it.each([
        ["owner", true],
        ["manager", true],
        ["staff", false],
    ] as const)("answers %s as %s", (role, expected) => {
        expect(isManagerRole(role)).toBe(expected)
    })
})

describe("admitMember", () => {
    it("refuses a disabled member", () => {
        expect(admitMember(memberOf({ status: "disabled" }), [])).toBeRefused(WorkspaceMembersErrorCode.NotMember)
    })

    it("admits any active member when no role is required", () => {
        const member = memberOf()
        expect(admitMember(member, [])).toSucceedWith(member)
    })

    it("admits a member holding one of the required roles", () => {
        const member = memberOf({ role: "manager" })
        expect(admitMember(member, ["owner", "manager"])).toSucceedWith(member)
    })

    it("refuses a member whose role is not among the required ones", () => {
        expect(admitMember(memberOf(), ["owner", "manager"])).toBeRefused(WorkspaceMembersErrorCode.RoleForbidden)
    })
})

describe("canDecide", () => {
    it("never lets a disabled member decide", () => {
        expect(canDecide(memberOf({ role: "owner", status: "disabled" }), {})).toBe(false)
    })

    it("lets owner and manager decide anything", () => {
        expect(canDecide(memberOf({ role: "owner" }), { assigneeKind: "agent", assigneeId: "x" })).toBe(true)
        expect(canDecide(memberOf({ role: "manager" }), {})).toBe(true)
    })

    it("lets staff decide only the items assigned to them", () => {
        const staff = memberOf()
        expect(canDecide(staff, { assigneeKind: "staff", assigneeId: "staff-1" })).toBe(true)
        expect(canDecide(staff, { assigneeId: "staff-1" })).toBe(true)
        expect(canDecide(staff, { assigneeKind: "staff", assigneeId: "staff-2" })).toBe(false)
        expect(canDecide(staff, {})).toBe(false)
    })

    it("refuses staff for an item assigned to something that is not staff", () => {
        expect(canDecide(memberOf(), { assigneeKind: "agent", assigneeId: "staff-1" })).toBe(false)
    })

    it("refuses a staff account that is linked to no staff row", () => {
        expect(canDecide(memberOf({ staffId: null }), { assigneeId: null })).toBe(false)
    })
})
