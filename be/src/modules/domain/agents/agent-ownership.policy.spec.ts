import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import {
    ASSIGNABLE_ROLES,
    ROOM_KEYS,
    isAssignableRole,
    mayAssign,
    mayTag,
    ownerCardOf,
    resolveOwners,
    rolesOf,
} from "./agent-ownership.policy"
import type { AssignContext, MemberState, TagContext } from "./agents-reads.contracts"

type Subject = {
    isAssignableRole: typeof isAssignableRole
    mayAssign: typeof mayAssign
    mayTag: typeof mayTag
    ownerCardOf: typeof ownerCardOf
    resolveOwners: typeof resolveOwners
    rolesOf: typeof rolesOf
}

const SUBJECT = Symbol("agent-ownership.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { isAssignableRole, mayAssign, mayTag, ownerCardOf, resolveOwners, rolesOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const assignOf = builder<AssignContext>({
    role: "staff",
    memberStatus: "active",
    agentStatus: "active",
    assignableRoles: ["owner", "manager"],
    assignableRooms: [],
    memberRooms: [],
})

const tagOf = builder<TagContext>({
    fromStatus: "active",
    toStatus: "active",
    sameWorkspace: true,
    listed: true,
    sameAgent: false,
})

const memberOf = builder<MemberState>({
    id: "m1",
    displayName: "Minh",
    role: "manager",
    status: "active",
    roomKey: "sales",
})

describe("ownership constants and roles", () => {
    it("lists the three workspace roles and the six department rooms", () => {
        expect(ASSIGNABLE_ROLES).toEqual(["owner", "manager", "staff"])
        expect(ROOM_KEYS).toEqual(["executive", "frontdesk", "sales", "marketing", "care", "accounting"])
    })

    it("knows a role by its name", async () => {
        const subject = await buildSubject()

        expect(subject.isAssignableRole("manager")).toBe(true)
        expect(subject.isAssignableRole("boss")).toBe(false)
    })

    it("keeps the real stored roles in the order the page shows them and drops the unknown", async () => {
        const subject = await buildSubject()

        expect(subject.rolesOf(["staff", "ghost", "owner"])).toEqual(["owner", "staff"])
        expect(subject.rolesOf([])).toEqual([])
    })
})

describe("resolveOwners", () => {
    const agent = { ownerMemberId: "own", fallbackMemberId: "fb" }

    it("answers the owner first and the fallback after while both are active", async () => {
        const subject = await buildSubject()

        expect(subject.resolveOwners(agent, new Set(["own", "fb", "ws"]), "ws")).toEqual({
            ownerMemberId: "own",
            fallbackMemberId: "fb",
        })
    })

    it("hands over to the fallback when the owner left or is disabled", async () => {
        const subject = await buildSubject()

        expect(subject.resolveOwners(agent, new Set(["fb"]), "ws")).toEqual({
            ownerMemberId: "fb",
            fallbackMemberId: "ws",
        })
    })

    it("hands over to the workspace owner when both stored people are gone", async () => {
        const subject = await buildSubject()

        expect(subject.resolveOwners(agent, new Set(), "ws")).toEqual({ ownerMemberId: "ws", fallbackMemberId: null })
    })

    it("does not list the workspace owner twice when it is the stored owner", async () => {
        const subject = await buildSubject()
        const stored = { ownerMemberId: "ws", fallbackMemberId: "ws" }

        expect(subject.resolveOwners(stored, new Set(["ws"]), "ws")).toEqual({
            ownerMemberId: "ws",
            fallbackMemberId: null,
        })
    })

    it("answers the stored owner alone when the workspace has no active owner", async () => {
        const subject = await buildSubject()

        expect(subject.resolveOwners(agent, new Set(["own"]), null)).toEqual({
            ownerMemberId: "own",
            fallbackMemberId: null,
        })
    })

    it("answers nobody when the whole chain is inactive", async () => {
        const subject = await buildSubject()

        expect(subject.resolveOwners(agent, new Set(), null)).toBeNull()
    })

    it("skips the missing members of a legacy agent", async () => {
        const subject = await buildSubject()
        const legacy = { ownerMemberId: null, fallbackMemberId: null }

        expect(subject.resolveOwners(legacy, new Set(), "ws")).toEqual({ ownerMemberId: "ws", fallbackMemberId: null })
    })
})

describe("mayAssign", () => {
    it("admits a member by role", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ role: "manager" }))).toBe(true)
    })

    it("refuses a role the agent is not open to", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ role: "staff" }))).toBe(false)
    })

    it("admits a staff member who sits in a room the agent is open to", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ assignableRooms: ["sales"], memberRooms: ["care", "sales"] }))).toBe(true)
    })

    it("refuses a member whose seat is in another room", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ assignableRooms: ["sales"], memberRooms: ["care"] }))).toBe(false)
    })

    it("refuses once the room was revoked from the agent", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ assignableRooms: [], memberRooms: ["sales"] }))).toBe(false)
    })

    it("refuses once the member lost the seat", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ assignableRooms: ["sales"], memberRooms: [] }))).toBe(false)
    })

    it("refuses a disabled member even when the role qualifies", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ role: "owner", memberStatus: "disabled" }))).toBe(false)
    })

    it("refuses a paused agent", async () => {
        const subject = await buildSubject()

        expect(subject.mayAssign(assignOf({ role: "owner", agentStatus: "paused" }))).toBe(false)
    })
})

describe("mayTag", () => {
    it("admits a listed active agent of the same workspace", async () => {
        const subject = await buildSubject()

        expect(subject.mayTag(tagOf())).toBe(true)
    })

    it.each([
        { name: "itself", change: { sameAgent: true } },
        { name: "an agent of another workspace", change: { sameWorkspace: false } },
        { name: "an agent that is not on its list", change: { listed: false } },
        { name: "from a paused agent", change: { fromStatus: "paused" } },
        { name: "a paused agent", change: { toStatus: "paused" } },
    ])("refuses $name", async ({ change }) => {
        const subject = await buildSubject()

        expect(subject.mayTag(tagOf(change))).toBe(false)
    })
})

describe("ownerCardOf", () => {
    it("shows an active member with their room", async () => {
        const subject = await buildSubject()

        expect(subject.ownerCardOf(memberOf())).toEqual({
            memberId: "m1",
            name: "Minh",
            role: "manager",
            roomId: "sales",
            active: true,
        })
    })

    it("marks a disabled member inactive and a roomless one with no room", async () => {
        const subject = await buildSubject()

        expect(subject.ownerCardOf(memberOf({ status: "disabled", roomKey: null }))).toMatchObject({
            roomId: null,
            active: false,
        })
    })
})
