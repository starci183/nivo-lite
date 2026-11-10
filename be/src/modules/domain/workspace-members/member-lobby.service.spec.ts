import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { seatRowOf } from "@tests/fixtures/builders/workspace-members.builder"
import { EventsService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { MemberLobbyService } from "./member-lobby.service"
import { WorkspaceMemberEntity } from "./persistence/entities"

const NOW = new Date("2026-11-09T08:00:00.000Z")

const build = async (entityManager: MockEntityManager) => {
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MemberLobbyService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(MemberLobbyService), events }
}

describe("MemberLobbyService > markOpened", () => {
    it("stamps the active seat of the person unless it was stamped within the last minute", async () => {
        const em = mockEntityManager()
        const stamp = fakeQueryBuilder({ execute: { affected: 1 } })
        em.createQueryBuilder.mockReturnValue(stamp.builder)
        const { service } = await build(em)

        await service.markOpened("ws-1", "user-1")

        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceMemberEntity, "m")
        expect(stamp.callsOf("set")).toEqual([[{ lastOpenedAt: NOW }]])
        expect(stamp.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND user_id = :userId AND status = 'active'",
                { workspaceId: "ws-1", userId: "user-1" },
            ],
        ])
        expect(stamp.callsOf("andWhere")).toEqual([
            ["(last_opened_at IS NULL OR last_opened_at < :stale)", { stale: new Date("2026-11-09T07:59:00.000Z") }],
        ])
        expect(stamp.callsOf("execute")).toHaveLength(1)
    })
})

describe("MemberLobbyService > leave", () => {
    it("removes the seat of the person and records that they left", async () => {
        const em = mockEntityManager({
            findOne: [WorkspaceMemberEntity, seatRowOf("staff", "active", "user-1", "An")],
            delete: [WorkspaceMemberEntity, { affected: 1 }],
        })
        const { service, events } = await build(em)

        await service.leave("user-1", "ws-1")

        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { id: true, displayName: true },
            where: { workspaceId: "ws-1", userId: "user-1" },
        })
        expect(em.delete).toHaveBeenCalledWith(WorkspaceMemberEntity, { id: "member-1" })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.left",
            actor: "An",
            summary: "An",
        })
    })

    it("lets a disabled member leave too", async () => {
        const em = mockEntityManager({
            findOne: [WorkspaceMemberEntity, seatRowOf("staff", "disabled")],
            delete: [WorkspaceMemberEntity, { affected: 1 }],
        })
        const { service } = await build(em)

        await expect(service.leave("user-1", "ws-1")).resolves.toBeUndefined()
    })

    it("refuses a person who holds no seat in the workspace", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, null] })
        const { service, events } = await build(em)

        await expect(service.leave("user-1", "ws-1")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.NotMember,
        })
        expect(em.delete).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses the last active owner with its own reason", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, seatRowOf("owner")] })
        em.delete.mockRejectedValueOnce(new Error("new row violates: last_owner"))
        const { service, events } = await build(em)

        await expect(service.leave("user-1", "ws-1")).rejects.toMatchObject({
            code: WorkspaceMembersErrorCode.LastOwnerLeave,
        })
        expect(events.record).not.toHaveBeenCalled()
    })

    it("lets any other failure of the delete through", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, seatRowOf("staff")] })
        const failure = new Error("connection reset")
        em.delete.mockRejectedValueOnce(failure)
        const { service } = await build(em)

        await expect(service.leave("user-1", "ws-1")).rejects.toBe(failure)
    })
})

describe("MemberLobbyService > disableAll", () => {
    it("disables every active seat through the manager of the deletion", async () => {
        const em = mockEntityManager()
        const tx = mockEntityManager({ update: [WorkspaceMemberEntity, { affected: 3 }] })
        const { service } = await build(em)

        await service.disableAll("ws-1", tx)

        expect(tx.update).toHaveBeenCalledWith(
            WorkspaceMemberEntity,
            { workspaceId: "ws-1", status: "active" },
            { status: "disabled", disabledByDeletion: true },
        )
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("MemberLobbyService > enableAfterRestore", () => {
    it("switches on exactly the seats the deletion switched off", async () => {
        const tx = mockEntityManager({ update: [WorkspaceMemberEntity, { affected: 2 }] })
        const { service } = await build(mockEntityManager())

        await service.enableAfterRestore("ws-1", tx)

        expect(tx.update).toHaveBeenCalledWith(
            WorkspaceMemberEntity,
            { workspaceId: "ws-1", disabledByDeletion: true },
            { status: "active", disabledByDeletion: false },
        )
    })
})

describe("MemberLobbyService > holdsOwnerSeat", () => {
    it("asks for an owner seat in any status", async () => {
        const tx = mockEntityManager({ exists: [WorkspaceMemberEntity, true] })
        const { service } = await build(mockEntityManager())

        await expect(service.holdsOwnerSeat("ws-1", "user-1", tx)).resolves.toBe(true)
        expect(tx.exists).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "ws-1", userId: "user-1", role: "owner" },
        })
    })
})
