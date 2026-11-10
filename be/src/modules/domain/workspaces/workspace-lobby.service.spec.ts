import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { MemberLobbyService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { workspaceRow } from "@tests/fixtures/builders/workspaces.builder"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import { WorkspaceLobbyService } from "./workspace-lobby.service"

const NOW = new Date("2026-11-09T08:00:00.000Z")

const OWNER = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner" as const,
    staffId: null,
    displayName: "Linh",
    status: "active" as const,
}

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(OWNER)
    const seats = mock<MemberLobbyService>()
    seats.disableAll.mockResolvedValue(undefined)
    seats.enableAfterRestore.mockResolvedValue(undefined)
    seats.holdsOwnerSeat.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceLobbyService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MemberLobbyService, useValue: seats },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceLobbyService), members, seats }
}

describe("WorkspaceLobbyService > rename", () => {
    it("renames the living workspace to the trimmed name for its owner or a manager", async () => {
        const em = mockEntityManager({ update: [WorkspaceEntity, { affected: 1 }] })
        const { service, members } = await build(em)

        await service.rename("user-1", "ws-1", "  Spa Hoa Mai  ")

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(em.update).toHaveBeenCalledWith(
            WorkspaceEntity,
            { id: "ws-1", deletedAt: IsNull() },
            { name: "Spa Hoa Mai" },
        )
    })

    it.each([" ", "x".repeat(121)])("refuses an empty or too long name before any read", async (name) => {
        const em = mockEntityManager()
        const { service, members } = await build(em)

        await expect(service.rename("user-1", "ws-1", name)).rejects.toMatchObject({
            code: WorkspacesErrorCode.NameInvalid,
        })
        expect(members.require).not.toHaveBeenCalled()
    })

    it("refuses a caller the members service refuses", async () => {
        const denied = new Error("role forbidden")
        const em = mockEntityManager()
        const { service, members } = await build(em)
        members.require.mockRejectedValue(denied)

        await expect(service.rename("user-2", "ws-1", "New")).rejects.toBe(denied)
        expect(em.update).not.toHaveBeenCalled()
    })

    it("refuses as not found a workspace that is gone", async () => {
        const em = mockEntityManager({ update: [WorkspaceEntity, {}] })
        const { service } = await build(em)

        await expect(service.rename("user-1", "ws-1", "New")).rejects.toMatchObject({
            code: WorkspacesErrorCode.NotFound,
        })
    })
})

describe("WorkspaceLobbyService > remove", () => {
    it("soft-deletes the workspace and disables its seats in one transaction, for its owner who typed its name", async () => {
        const em = mockEntityManager({
            findOne: [WorkspaceEntity, workspaceRow({ name: "Spa Hoa Mai" })],
            update: [WorkspaceEntity, { affected: 1 }],
        })
        const transaction = fakeTransaction(em)
        const { service, members, seats } = await build(em)

        await service.remove("user-1", "ws-1", " Spa Hoa Mai ")

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner"])
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, name: true },
            where: { id: "ws-1", deletedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-1" }, { deletedAt: NOW })
        expect(seats.disableAll).toHaveBeenCalledWith("ws-1", expect.anything())
        expect(transaction.commits).toBe(1)
    })

    it("refuses a typed name that is not the workspace's and changes nothing", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow({ name: "Spa Hoa Mai" })] })
        const transaction = fakeTransaction(em)
        const { service, seats } = await build(em)

        await expect(service.remove("user-1", "ws-1", "Spa")).rejects.toMatchObject({
            code: WorkspacesErrorCode.DeleteConfirmMismatch,
        })
        expect(em.update).not.toHaveBeenCalled()
        expect(seats.disableAll).not.toHaveBeenCalled()
        expect(transaction.rollbacks).toBe(1)
    })

    it("refuses as not found a workspace already deleted", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceEntity, null] })
        fakeTransaction(em)
        const { service } = await build(em)

        await expect(service.remove("user-1", "ws-1", "Spa")).rejects.toMatchObject({
            code: WorkspacesErrorCode.NotFound,
        })
    })

    it("opens no transaction for a caller who is not the owner", async () => {
        const denied = new Error("role forbidden")
        const em = mockEntityManager()
        const { service, members } = await build(em)
        members.require.mockRejectedValue(denied)

        await expect(service.remove("user-2", "ws-1", "Spa")).rejects.toBe(denied)
        expect(em.transaction).not.toHaveBeenCalled()
    })
})

describe("WorkspaceLobbyService > restore", () => {
    const deletedOn = (iso: string) => workspaceRow({ deletedAt: new Date(iso) })

    it("brings the workspace back and switches its seats on again, in one transaction", async () => {
        const em = mockEntityManager({
            findOne: [WorkspaceEntity, deletedOn("2026-11-01T00:00:00.000Z")],
            update: [WorkspaceEntity, { affected: 1 }],
        })
        const transaction = fakeTransaction(em)
        const { service, seats } = await build(em)

        await service.restore("user-1", "ws-1")

        expect(seats.holdsOwnerSeat).toHaveBeenCalledWith("ws-1", "user-1", expect.anything())
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-1" }, { deletedAt: null })
        expect(seats.enableAfterRestore).toHaveBeenCalledWith("ws-1", expect.anything())
        expect(transaction.commits).toBe(1)
    })

    it("refuses after the restore window", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceEntity, deletedOn("2026-10-01T00:00:00.000Z")] })
        fakeTransaction(em)
        const { service, seats } = await build(em)

        await expect(service.restore("user-1", "ws-1")).rejects.toMatchObject({
            code: WorkspacesErrorCode.RestoreExpired,
        })
        expect(seats.enableAfterRestore).not.toHaveBeenCalled()
    })

    it("refuses as not found a caller who holds no owner seat, or a workspace that is not deleted", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceEntity, deletedOn("2026-11-01T00:00:00.000Z")] })
        fakeTransaction(em)
        const { service, seats } = await build(em)
        seats.holdsOwnerSeat.mockResolvedValue(false)

        await expect(service.restore("user-2", "ws-1")).rejects.toMatchObject({ code: WorkspacesErrorCode.NotFound })

        const living = mockEntityManager({ findOne: [WorkspaceEntity, null] })
        fakeTransaction(living)
        await expect((await build(living)).service.restore("user-1", "ws-1")).rejects.toMatchObject({
            code: WorkspacesErrorCode.NotFound,
        })
    })
})
