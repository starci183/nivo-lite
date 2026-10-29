import { Test } from "@nestjs/testing"
import { Not, In } from "typeorm"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { MemberGrantsErrorCode } from "./errors/member-grants.error"
import { MemberGrantsService } from "./member-grants.service"
import type { MemberGrant } from "./member-grants.contracts"
import { MemberGrantEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MemberGrantsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(MemberGrantsService)
}

/** What an insert query builder was told to write; a function value (the save time) is read by calling it. */
const writtenBy = (fake: FakeQueryBuilder | undefined): Record<string, unknown> => {
    const [values] = fake?.callsOf("values")[0] ?? []
    return evaluatedValues(values)
}

const directoryRowOf = builder<{
    member_id: string
    name: string
    role: "manager" | "staff"
    status: "active"
    rooms: Array<string>
}>({
    member_id: "member-1",
    name: "Anh Minh",
    role: "manager",
    status: "active",
    rooms: ["sales", "executive"],
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
        const em = mockEntityManager()
        const [directory] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    directoryRowOf(),
                    directoryRowOf({ member_id: "member-2", name: "Van", role: "staff", rooms: [] }),
                ],
            },
        ])
        const service = await build(em)

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
        expect(directory?.callsOf("from")).toEqual([["public.workspace_members", "m"]])
        expect(directory?.callsOf("where")).toEqual([["m.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(directory?.callsOf("limit")).toEqual([[500]])
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
        const [guard1, insert1, guard2, insert2, listing] = queueQueryBuilders(tx.em, [
            { getRawOne: { member_id: "member-1", unit: "vnd" } },
            { execute: { raw: [grantRowOf()] } },
            { getRawOne: { member_id: "member-2", unit: "percent" } },
            { execute: { raw: [second] } },
            { getRawMany: [grantRowOf(), second] },
        ])
        const service = await build(tx.em)

        const grants = await service.replaceForAction("ws-1", "give_discount", [
            { memberId: "member-1", maxAmount: 15 },
            { memberId: "member-2", maxAmount: null },
        ])

        expect(grants).toHaveLength(2)
        expect(guard1?.callsOf("setLock")).toEqual([["pessimistic_read"]])
        expect(guard2?.callsOf("where")).toEqual([
            ["m.id = :memberId AND m.workspace_id = :workspaceId", { memberId: "member-2", workspaceId: "ws-1" }],
        ])
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
    it("refuses the whole change when a member is outside the workspace or the action is unknown", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const [guard, insert] = queueQueryBuilders(tx.em, [{ getRawOne: undefined }, { execute: { raw: [] } }])
        const service = await build(tx.em)

        await expect(
            service.replaceForAction("ws-1", "give_discount", [{ memberId: "stranger", maxAmount: 1 }]),
        ).rejects.toMatchObject({
            code: MemberGrantsErrorCode.UnknownTarget,
            params: { action: "give_discount" },
        })
        expect(tx.rollbacks).toBe(1)
        expect(guard?.callsOf("getRawOne")).toHaveLength(1)
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
