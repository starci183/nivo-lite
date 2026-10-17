import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import {
    admitMember as realAdmitMember,
    canDecide as realCanDecide,
    isManagerRole as realIsManagerRole,
    judgeSeatChange as realJudgeSeatChange,
    presentedRole as realPresentedRole,
    PresentedRole,
} from "./role.policy"
import type { WorkspaceMember } from "./workspace-members.contracts"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "staff-1",
    displayName: "An",
    status: "active",
})

const SUBJECT = Symbol("role.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    admitMember: realAdmitMember,
                    canDecide: realCanDecide,
                    isManagerRole: realIsManagerRole,
                    judgeSeatChange: realJudgeSeatChange,
                    presentedRole: realPresentedRole,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./role.policy")>(SUBJECT)
}

describe("isManagerRole", () => {
    it.each([
        ["owner", true],
        ["manager", true],
        ["staff", false],
    ] as const)("answers %s as %s", async (role, expected) => {
        const { isManagerRole } = await buildSubject()

        expect(isManagerRole(role)).toBe(expected)
    })
})

describe("admitMember", () => {
    it("refuses a disabled member", async () => {
        const { admitMember } = await buildSubject()

        expect(admitMember(memberOf({ status: "disabled" }), [])).toBeRefused(WorkspaceMembersErrorCode.NotMember)
    })

    it("admits any active member when no role is required", async () => {
        const { admitMember } = await buildSubject()

        const member = memberOf()
        expect(admitMember(member, [])).toSucceedWith(member)
    })

    it("admits a member holding one of the required roles", async () => {
        const { admitMember } = await buildSubject()

        const member = memberOf({ role: "manager" })
        expect(admitMember(member, ["owner", "manager"])).toSucceedWith(member)
    })

    it("refuses a member whose role is not among the required ones", async () => {
        const { admitMember } = await buildSubject()

        expect(admitMember(memberOf(), ["owner", "manager"])).toBeRefused(WorkspaceMembersErrorCode.RoleForbidden)
    })
})

describe("canDecide", () => {
    it("never lets a disabled member decide", async () => {
        const { canDecide } = await buildSubject()

        expect(canDecide(memberOf({ role: "owner", status: "disabled" }), {})).toBe(false)
    })

    it("lets owner and manager decide anything", async () => {
        const { canDecide } = await buildSubject()

        expect(canDecide(memberOf({ role: "owner" }), { assigneeKind: "agent", assigneeId: "x" })).toBe(true)
        expect(canDecide(memberOf({ role: "manager" }), {})).toBe(true)
    })

    it("lets staff decide only the items assigned to them", async () => {
        const { canDecide } = await buildSubject()

        const staff = memberOf()
        expect(canDecide(staff, { assigneeKind: "staff", assigneeId: "staff-1" })).toBe(true)
        expect(canDecide(staff, { assigneeId: "staff-1" })).toBe(true)
        expect(canDecide(staff, { assigneeKind: "staff", assigneeId: "staff-2" })).toBe(false)
        expect(canDecide(staff, {})).toBe(false)
    })

    it("refuses staff for an item assigned to something that is not staff", async () => {
        const { canDecide } = await buildSubject()

        expect(canDecide(memberOf(), { assigneeKind: "agent", assigneeId: "staff-1" })).toBe(false)
    })

    it("refuses a staff account that is linked to no staff row", async () => {
        const { canDecide } = await buildSubject()

        expect(canDecide(memberOf({ staffId: null }), { assigneeId: null })).toBe(false)
    })
})

describe("presentedRole", () => {
    it.each([
        ["owner", PresentedRole.Owner],
        ["manager", PresentedRole.Manager],
        ["staff", PresentedRole.Staff],
    ] as const)("presents %s as %s", async (role, expected) => {
        const { presentedRole } = await buildSubject()

        expect(presentedRole(role)).toBe(expected)
    })

    it.each(["", "administrator", "constructor", "toString", "__proto__", undefined, null, 0, {}, ["owner"]])(
        "presents malformed runtime role %p as staff",
        async (role) => {
            const { presentedRole } = await buildSubject()

            const member = memberOf()
            Object.assign(member, { role })
            expect(presentedRole(member.role)).toBe(PresentedRole.Staff)
        },
    )
})

describe("judgeSeatChange", () => {
    it("refuses a staff actor", async () => {
        const { judgeSeatChange } = await buildSubject()

        expect(
            judgeSeatChange({ actor: memberOf(), target: memberOf({ userId: "user-2" }) }, { forbidSelf: false }),
        ).toBeRefused(WorkspaceMembersErrorCode.ChangeNotAllowed)
    })

    it("refuses a forbidden change to oneself", async () => {
        const { judgeSeatChange } = await buildSubject()

        const actor = memberOf({ role: "owner" })
        expect(judgeSeatChange({ actor, target: actor }, { forbidSelf: true })).toBeRefused(
            WorkspaceMembersErrorCode.SelfForbidden,
        )
    })

    it("permits a role change to oneself when the operation permits it", async () => {
        const { judgeSeatChange } = await buildSubject()

        const actor = memberOf({ role: "owner" })
        expect(judgeSeatChange({ actor, target: actor }, { forbidSelf: false, nextRole: "staff" })).toSucceedWith(true)
    })

    it("refuses a manager changing an owner", async () => {
        const { judgeSeatChange } = await buildSubject()

        expect(
            judgeSeatChange(
                { actor: memberOf({ role: "manager" }), target: memberOf({ userId: "user-2", role: "owner" }) },
                { forbidSelf: true },
            ),
        ).toBeRefused(WorkspaceMembersErrorCode.ChangeNotAllowed)
    })

    it("refuses a manager granting the owner role", async () => {
        const { judgeSeatChange } = await buildSubject()

        expect(
            judgeSeatChange(
                { actor: memberOf({ role: "manager" }), target: memberOf({ userId: "user-2" }) },
                { forbidSelf: false, nextRole: "owner" },
            ),
        ).toBeRefused(WorkspaceMembersErrorCode.ChangeNotAllowed)
    })

    it("permits an owner to change another owner", async () => {
        const { judgeSeatChange } = await buildSubject()

        expect(
            judgeSeatChange(
                { actor: memberOf({ role: "owner" }), target: memberOf({ userId: "user-2", role: "owner" }) },
                { forbidSelf: true, nextRole: "owner" },
            ),
        ).toSucceedWith(true)
    })

    it("permits a manager changing another staff seat", async () => {
        const { judgeSeatChange } = await buildSubject()

        expect(
            judgeSeatChange(
                { actor: memberOf({ role: "manager" }), target: memberOf({ userId: "user-2" }) },
                { forbidSelf: true, nextRole: "manager" },
            ),
        ).toSucceedWith(true)
    })
})
