import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import type { ApproverInput } from "./approval-requests.contracts"
import { resolveApprovers } from "./approver-set.policy"

const SUBJECT = Symbol("approver-set.policy")

const memberOf = builder<DirectoryMember>({
    memberId: "member-1",
    name: "Chu Van",
    role: "owner",
    roomId: null,
    status: "active",
    rooms: [],
})

const grantOf = builder<MemberGrant>({
    id: "grant-1",
    workspace_id: "ws-1",
    member_id: "member-2",
    action: "give_discount",
    unit: "percent",
    max_amount: 15,
    updated_at: "2026-10-22T09:00:00.000Z",
})

const inputOf = builder<ApproverInput>({
    group: { roles: [], rooms: [], members: [] },
    directory: [],
    grants: [],
    need: { unit: "percent", amount: 10 },
})

/** The Sales story of the plan: a manager and a sales member with grants, a staff member in the room, a named person. */
const HAKUEN: ReadonlyArray<DirectoryMember> = [
    memberOf(),
    memberOf({ memberId: "member-2", name: "Anh Minh", role: "manager", roomId: "sales", rooms: ["sales"] }),
    memberOf({ memberId: "member-3", name: "Ha", role: "manager", roomId: "executive", rooms: ["executive"] }),
    memberOf({ memberId: "member-4", name: "Lan", role: "staff", roomId: "sales", rooms: ["sales"] }),
    memberOf({ memberId: "member-5", name: "Nam", role: "staff", roomId: null, rooms: [] }),
    memberOf({ memberId: "member-6", name: "Van", role: "staff", roomId: "accounting", rooms: ["accounting"] }),
]

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { resolveApprovers } }],
    }).compile()
    return moduleRef.get<{ resolveApprovers: typeof resolveApprovers }>(SUBJECT)
}

describe("approver set policy", () => {
    it("is empty when the group is empty, and excludes nobody: the others were never asked", async () => {
        const subject = await buildSubject()

        expect(subject.resolveApprovers(inputOf({ directory: HAKUEN }))).toEqual({ approvers: [], excluded: [] })
    })

    it("tags the members of the group whose grants cover the amount and lists the rest with the reason", async () => {
        const subject = await buildSubject()
        const input = inputOf({
            directory: HAKUEN,
            group: { roles: ["manager"], rooms: ["sales"], members: ["member-5"] },
            grants: [
                grantOf({ member_id: "member-2", max_amount: 15 }),
                grantOf({ id: "grant-2", member_id: "member-3", max_amount: 5 }),
                grantOf({ id: "grant-3", member_id: "member-5", max_amount: null }),
            ],
        })

        expect(subject.resolveApprovers(input)).toEqual({
            approvers: [
                { memberId: "member-5", name: "Nam", role: "staff", roomId: null },
                { memberId: "member-2", name: "Anh Minh", role: "manager", roomId: "sales" },
            ],
            excluded: [
                { memberId: "member-3", reason: "over_limit" },
                { memberId: "member-4", reason: "no_grant" },
            ],
        })
    })

    it("always tags the workspace owner when the group names the owner role", async () => {
        const subject = await buildSubject()

        const set = subject.resolveApprovers(
            inputOf({ directory: HAKUEN, group: { roles: ["owner"], rooms: [], members: [] } }),
        )

        expect(set.approvers).toEqual([{ memberId: "member-1", name: "Chu Van", role: "owner", roomId: null }])
    })
})

describe("approver set policy > order and corner cases", () => {
    it("asks the members the rule names first, in the order it lists them, then the rest of the group in directory order", async () => {
        const subject = await buildSubject()
        const input = inputOf({
            directory: HAKUEN,
            group: { roles: ["manager"], rooms: [], members: ["member-3", "member-1"] },
            grants: [grantOf({ member_id: "member-2" }), grantOf({ id: "grant-2", member_id: "member-3" })],
        })

        expect(subject.resolveApprovers(input).approvers.map((member) => member.memberId)).toEqual([
            "member-3",
            "member-1",
            "member-2",
        ])
    })

    it("lists a disabled member of the group as inactive, even the owner", async () => {
        const subject = await buildSubject()
        const input = inputOf({
            directory: [
                memberOf({ status: "disabled" }),
                memberOf({ memberId: "member-2", name: "Anh Minh", role: "manager", status: "disabled" }),
            ],
            group: { roles: ["owner", "manager"], rooms: [], members: [] },
            grants: [grantOf()],
        })

        expect(subject.resolveApprovers(input)).toEqual({
            approvers: [],
            excluded: [
                { memberId: "member-1", reason: "inactive" },
                { memberId: "member-2", reason: "inactive" },
            ],
        })
    })
})

describe("approver set policy > people in the group twice", () => {
    it("counts a person once when they are in the group by role, by room and by name", async () => {
        const subject = await buildSubject()
        const input = inputOf({
            directory: [
                memberOf({
                    memberId: "member-2",
                    name: "Anh Minh",
                    role: "manager",
                    roomId: "sales",
                    rooms: ["sales"],
                }),
            ],
            group: { roles: ["manager"], rooms: ["sales"], members: ["member-2"] },
            grants: [grantOf()],
        })

        expect(subject.resolveApprovers(input).approvers).toHaveLength(1)
    })

    it("ignores a named member that is not in the directory", async () => {
        const subject = await buildSubject()
        const input = inputOf({ directory: HAKUEN, group: { roles: [], rooms: [], members: ["gone"] } })

        expect(subject.resolveApprovers(input)).toEqual({ approvers: [], excluded: [] })
    })

    it("seats a member of two rooms in both groups and names the first as their room", async () => {
        const subject = await buildSubject()
        const input = inputOf({
            directory: [
                memberOf({
                    memberId: "member-2",
                    name: "Anh Minh",
                    role: "manager",
                    roomId: "sales",
                    rooms: ["sales", "executive"],
                }),
            ],
            group: { roles: [], rooms: ["executive"], members: [] },
            grants: [grantOf()],
        })

        expect(subject.resolveApprovers(input).approvers).toEqual([
            { memberId: "member-2", name: "Anh Minh", role: "manager", roomId: "sales" },
        ])
    })
})
