import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MemberGrantsErrorCode } from "./errors/member-grants.error"
import { MemberGrantsService } from "./member-grants.service"
import type { DirectoryRow, GrantRow } from "./persistence/member-grants.rows"
import { DELETE_OTHER_GRANTS, LIST_ACTION_GRANTS, LIST_DIRECTORY, UPSERT_GRANT } from "./persistence/member-grants.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MemberGrantsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(MemberGrantsService)
}

const directoryRowOf = builder<DirectoryRow>({
    member_id: "member-1",
    name: "Anh Minh",
    role: "manager",
    status: "active",
    rooms: ["sales", "executive"],
})

const grantRowOf = builder<GrantRow>({
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
        const em = mockEntityManager({
            query: [
                LIST_DIRECTORY,
                [directoryRowOf(), directoryRowOf({ member_id: "member-2", name: "Van", role: "staff", rooms: [] })],
            ],
        })
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
        expect(em.query).toHaveBeenCalledWith(LIST_DIRECTORY, ["ws-1"])
    })
})

describe("MemberGrantsService > forAction", () => {
    it("lists the grants of one action of the workspace", async () => {
        const em = mockEntityManager({ query: [LIST_ACTION_GRANTS, [grantRowOf()]] })
        const service = await build(em)

        await expect(service.forAction("ws-1", "give_discount")).resolves.toEqual([grantRowOf()])
        expect(em.query).toHaveBeenCalledWith(LIST_ACTION_GRANTS, ["ws-1", "give_discount"])
    })
})

describe("MemberGrantsService > replaceForAction", () => {
    it("saves the limit of each member named, drops the rest and answers the grants now in force", async () => {
        const second = grantRowOf({ id: "grant-2", member_id: "member-2", max_amount: null })
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [UPSERT_GRANT, [grantRowOf()]],
                    [UPSERT_GRANT, [second]],
                    [DELETE_OTHER_GRANTS, []],
                    [LIST_ACTION_GRANTS, [grantRowOf(), second]],
                ],
            }),
        )
        const service = await build(tx.em)

        const grants = await service.replaceForAction("ws-1", "give_discount", [
            { memberId: "member-1", maxAmount: 15 },
            { memberId: "member-2", maxAmount: null },
        ])

        expect(grants).toHaveLength(2)
        expect(tx.em.query).toHaveBeenNthCalledWith(1, UPSERT_GRANT, ["ws-1", "member-1", "give_discount", 15])
        expect(tx.em.query).toHaveBeenNthCalledWith(2, UPSERT_GRANT, ["ws-1", "member-2", "give_discount", null])
        expect(tx.em.query).toHaveBeenNthCalledWith(3, DELETE_OTHER_GRANTS, [
            "ws-1",
            "give_discount",
            ["member-1", "member-2"],
        ])
        expect(tx.commits).toBe(1)
    })

    it("drops every grant of the action when no member is named", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [DELETE_OTHER_GRANTS, []],
                    [LIST_ACTION_GRANTS, []],
                ],
            }),
        )
        const service = await build(tx.em)

        await expect(service.replaceForAction("ws-1", "give_discount", [])).resolves.toEqual([])
        expect(tx.em.query).toHaveBeenNthCalledWith(1, DELETE_OTHER_GRANTS, ["ws-1", "give_discount", []])
    })

    it("refuses the whole change when a member is outside the workspace or the action is unknown", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [UPSERT_GRANT, []] }))
        const service = await build(tx.em)

        await expect(
            service.replaceForAction("ws-1", "give_discount", [{ memberId: "stranger", maxAmount: 1 }]),
        ).rejects.toMatchObject({
            code: MemberGrantsErrorCode.UnknownTarget,
            params: { action: "give_discount" },
        })
        expect(tx.rollbacks).toBe(1)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
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
