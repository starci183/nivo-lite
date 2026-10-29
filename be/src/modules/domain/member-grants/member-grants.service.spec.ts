import { Test } from "@nestjs/testing"
import { Not, In } from "typeorm"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { MemberRow } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { MemberGrantsErrorCode } from "./errors/member-grants.error"
import { MemberGrantsService } from "./member-grants.service"
import type { MemberGrant } from "./member-grants.contracts"
import { MemberGrantEntity } from "./persistence/entities"

/** What the owner capabilities answer: the members, their rooms, whether the member and the action exist, and the rule. */
interface Owners {
    readonly people?: Array<MemberRow>
    readonly seats?: Array<{ userId: string; key: string }>
    readonly member?: boolean
    readonly action?: boolean
    readonly unit?: ApprovalSetup["unit"] | null
}

const build = async (entityManager: MockEntityManager, owners: Owners = {}) => {
    const members = mock<WorkspaceMembersReadService>({
        directory: jest.fn().mockResolvedValue(owners.people ?? []),
        lockMember: jest.fn().mockResolvedValue(owners.member ?? true),
    })
    const rooms = mock<OfficeRoomDirectoryService>({ seatRoomsOf: jest.fn().mockResolvedValue(owners.seats ?? []) })
    const actions = mock<AuthorityActionsService>({ exists: jest.fn().mockResolvedValue(owners.action ?? true) })
    const rules = mock<AuthorityRulesService>({
        approvalSetup: jest
            .fn()
            .mockResolvedValue(owners.unit === null || owners.unit === undefined ? null : { unit: owners.unit }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            MemberGrantsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: OfficeRoomDirectoryService, useValue: rooms },
            { provide: AuthorityActionsService, useValue: actions },
            { provide: AuthorityRulesService, useValue: rules },
        ],
    }).compile()
    return Object.assign(moduleRef.get(MemberGrantsService), { doubles: { members, rooms, actions, rules } })
}

/** What an insert query builder was told to write; a function value (the save time) is read by calling it. */
const writtenBy = (fake: FakeQueryBuilder | undefined): Record<string, unknown> => {
    const [values] = fake?.callsOf("values")[0] ?? []
    return evaluatedValues(values)
}

const memberOf = builder<MemberRow>({
    id: "member-1",
    user_id: "user-1",
    display_name: "Anh Minh",
    role: "manager",
    status: "active",
})

const grantRowOf = builder<MemberGrant>({
    id: "grant-1",
    workspace_id: "ws-1",
    member_id: "member-1",
    action: "give_discount",
    unit: "percent",
    max_amount: 15,
    updated_at: "2026-10-22T09:00:00.000Z",
})

describe("MemberGrantsService > directory", () => {
    it("answers every member with the rooms they sit in; the room of a member is the first one", async () => {
        const service = await build(mockEntityManager(), {
            people: [memberOf(), memberOf({ id: "member-2", user_id: "user-2", display_name: "Van", role: "staff" })],
            seats: [
                { userId: "user-1", key: "sales" },
                { userId: "user-1", key: "executive" },
            ],
        })

        await expect(service.directory("ws-1")).resolves.toEqual([
            {
                memberId: "member-1",
                name: "Anh Minh",
                role: "manager",
                roomId: "sales",
                status: "active",
                rooms: ["sales", "executive"],
            },
            { memberId: "member-2", name: "Van", role: "staff", roomId: null, status: "active", rooms: [] },
        ])
        expect(service.doubles.members.directory).toHaveBeenCalledWith("ws-1", 500)
        expect(service.doubles.rooms.seatRoomsOf).toHaveBeenCalledWith("ws-1", ["user-1", "user-2"], 5000)
    })
})

describe("MemberGrantsService > forAction", () => {
    it("lists the grants of one action of the workspace", async () => {
        const em = mockEntityManager()
        const [grants] = queueQueryBuilders(em, [{ getRawMany: [grantRowOf()] }])
        const service = await build(em)

        await expect(service.forAction("ws-1", "give_discount")).resolves.toEqual([grantRowOf()])
        expect(grants?.callsOf("where")).toEqual([
            ["g.workspaceId = :workspaceId AND g.action = :action", { workspaceId: "ws-1", action: "give_discount" }],
        ])
        expect(grants?.callsOf("limit")).toEqual([[500]])
    })
})

describe("MemberGrantsService > replaceForAction", () => {
    it("saves the limit of each member named, drops the rest and answers the grants now in force", async () => {
        const second = grantRowOf({ id: "grant-2", member_id: "member-2", max_amount: null })
        const tx = fakeTransaction(mockEntityManager({ delete: [MemberGrantEntity, {}] }))
        const [insert1, insert2, listing] = queueQueryBuilders(tx.em, [
            { execute: { raw: [grantRowOf()] } },
            { execute: { raw: [second] } },
            { getRawMany: [grantRowOf(), second] },
        ])
        const service = await build(tx.em, { unit: "percent" })
        service.doubles.rules.approvalSetup.mockResolvedValueOnce(null)

        const grants = await service.replaceForAction("ws-1", "give_discount", [
            { memberId: "member-1", maxAmount: 15 },
            { memberId: "member-2", maxAmount: null },
        ])

        expect(grants).toHaveLength(2)
        expect(service.doubles.members.lockMember).toHaveBeenCalledWith(expect.anything(), "ws-1", "member-1")
        expect(service.doubles.members.lockMember).toHaveBeenCalledWith(expect.anything(), "ws-1", "member-2")
        expect(service.doubles.actions.exists).toHaveBeenCalledWith(expect.anything(), "give_discount")
        expect(service.doubles.rules.approvalSetup).toHaveBeenCalledWith("ws-1", "give_discount")
        const { updatedAt: stamp1, ...saved1 } = writtenBy(insert1)
        const { updatedAt: stamp2, ...saved2 } = writtenBy(insert2)
        expect(stamp1).toBe("now()")
        expect(stamp2).toBe("now()")
        expect(saved1).toEqual({
            workspaceId: "ws-1",
            memberId: "member-1",
            action: "give_discount",
            unit: "vnd",
            maxAmount: "15",
        })
        expect(saved2).toEqual({
            workspaceId: "ws-1",
            memberId: "member-2",
            action: "give_discount",
            unit: "percent",
            maxAmount: null,
        })
        expect(insert1?.callsOf("orUpdate")).toEqual([
            [
                ["unit", "max_amount", "updated_at"],
                ["member_id", "action"],
            ],
        ])
        expect(tx.em.delete).toHaveBeenCalledWith(MemberGrantEntity, {
            workspaceId: "ws-1",
            action: "give_discount",
            memberId: Not(In(["member-1", "member-2"])),
        })
        expect(listing?.callsOf("getRawMany")).toHaveLength(1)
        expect(tx.commits).toBe(1)
    })

    it("drops every grant of the action when no member is named", async () => {
        const tx = fakeTransaction(mockEntityManager({ delete: [MemberGrantEntity, {}] }))
        queueQueryBuilders(tx.em, [{ getRawMany: [] }])
        const service = await build(tx.em)

        await expect(service.replaceForAction("ws-1", "give_discount", [])).resolves.toEqual([])
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(tx.em.delete).toHaveBeenCalledWith(MemberGrantEntity, {
            workspaceId: "ws-1",
            action: "give_discount",
            memberId: Not(In([])),
        })
    })
})

describe("MemberGrantsService > replaceForAction refusals", () => {
    it.each([
        ["a member is outside the workspace", { member: false }],
        ["the action is unknown", { action: false }],
    ])("refuses the whole change when %s", async (_name, owners) => {
        const tx = fakeTransaction(mockEntityManager())
        const [insert] = queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
        const service = await build(tx.em, owners)

        await expect(
            service.replaceForAction("ws-1", "give_discount", [{ memberId: "stranger", maxAmount: 1 }]),
        ).rejects.toMatchObject({
            code: MemberGrantsErrorCode.UnknownTarget,
            params: { action: "give_discount" },
        })
        expect(tx.rollbacks).toBe(1)
        expect(service.doubles.rules.approvalSetup).not.toHaveBeenCalled()
        expect(insert?.calls).toHaveLength(0)
        expect(tx.em.delete).not.toHaveBeenCalled()
    })

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
        "refuses the limit %s before touching the table",
        async (limit) => {
            const em = mockEntityManager()
            const service = await build(em)

            await expect(
                service.replaceForAction("ws-1", "give_discount", [{ memberId: "member-1", maxAmount: limit }]),
            ).rejects.toMatchObject({ code: MemberGrantsErrorCode.InvalidLimit })
            expect(em.query).not.toHaveBeenCalled()
        },
    )
})
