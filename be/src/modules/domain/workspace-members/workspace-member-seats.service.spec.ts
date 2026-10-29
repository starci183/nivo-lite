import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMemberEntity } from "./persistence/entities"
import { WorkspaceMemberSeatsService } from "./workspace-member-seats.service"

const memberOf = entityOf(WorkspaceMemberEntity, {
    id: "m1",
    workspaceId: "w1",
    userId: "u1",
    role: "manager",
    staffId: null,
    displayName: "Mr Minh",
    status: "active",
})

const MINH = { memberId: "m1", userId: "u1", role: "manager", displayName: "Mr Minh", status: "active" }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceMemberSeatsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkspaceMemberSeatsService)
}

describe("WorkspaceMemberSeatsService > activeSeatOfUser", () => {
    it("answers the active seat of the account", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, memberOf()] })

        await expect((await build(em)).activeSeatOfUser("w1", "u1")).resolves.toEqual(MINH)
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "w1", userId: "u1", status: "active" },
        })
    })

    it("answers null when the account holds no active seat, reading through the manager it is handed", async () => {
        const own = mockEntityManager()
        const handed = mockEntityManager({ findOne: [WorkspaceMemberEntity, null] })

        await expect((await build(own)).activeSeatOfUser("w1", "u9", handed)).resolves.toBeNull()
        expect(own.findOne).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMemberSeatsService > activeSeatsOfUser", () => {
    it("lists the workspaces and roles of the account's active seats, newest first, bounded", async () => {
        const em = mockEntityManager({ find: [WorkspaceMemberEntity, [memberOf()]] })

        await expect((await build(em)).activeSeatsOfUser("u1", 200)).resolves.toEqual([
            { workspaceId: "w1", role: "manager" },
        ])
        expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { workspaceId: true, role: true },
            where: { userId: "u1", status: "active" },
            order: { createdAt: "DESC", id: "ASC" },
            take: 200,
        })
    })
})

describe("WorkspaceMemberSeatsService > activeUsers", () => {
    it("lists the active accounts by id, bounded", async () => {
        const em = mockEntityManager({ find: [WorkspaceMemberEntity, [memberOf()]] })

        await expect((await build(em)).activeUsers("w1", 500)).resolves.toEqual([
            { userId: "u1", displayName: "Mr Minh" },
        ])
        expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { userId: true, displayName: true },
            where: { workspaceId: "w1", status: "active" },
            order: { userId: "ASC" },
            take: 500,
        })
    })

    it("reads through the manager it is handed", async () => {
        const own = mockEntityManager()
        const handed = mockEntityManager({ find: [WorkspaceMemberEntity, []] })

        await expect((await build(own)).activeUsers("w1", 5, handed)).resolves.toEqual([])
        expect(own.find).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMemberSeatsService > seatsByIds", () => {
    it("reads the named seats whatever their status", async () => {
        const em = mockEntityManager({ find: [WorkspaceMemberEntity, [memberOf()]] })

        await expect((await build(em)).seatsByIds("w1", ["m1"], 10)).resolves.toEqual([MINH])
        expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "w1", id: In(["m1"]) },
            take: 10,
        })
    })

    it("reads nothing for no ids", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).seatsByIds("w1", [], 10)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMemberSeatsService > seatById", () => {
    it("answers the seat", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, memberOf()] })

        await expect((await build(em)).seatById("w1", "m1")).resolves.toEqual(MINH)
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, { where: { workspaceId: "w1", id: "m1" } })
    })

    it("answers null for a seat that does not exist", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, null] })

        await expect((await build(em)).seatById("w1", "m9")).resolves.toBeNull()
    })
})

describe("WorkspaceMemberSeatsService > countActiveAmong", () => {
    it("counts the active seats among the ids", async () => {
        const em = mockEntityManager({ count: [WorkspaceMemberEntity, 2] })

        await expect((await build(em)).countActiveAmong("w1", ["m1", "m2"])).resolves.toBe(2)
        expect(em.count).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "w1", id: In(["m1", "m2"]), status: "active" },
        })
    })

    it("counts none for no ids", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).countActiveAmong("w1", [])).resolves.toBe(0)
        expect(em.count).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMemberSeatsService > activeIdsAmong", () => {
    it("answers the ids that are active seats, bounded", async () => {
        const em = mockEntityManager({ find: [WorkspaceMemberEntity, [memberOf()]] })

        await expect((await build(em)).activeIdsAmong("w1", ["m1", "m2"], 5)).resolves.toEqual(["m1"])
        expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { id: true },
            where: { workspaceId: "w1", id: In(["m1", "m2"]), status: "active" },
            take: 5,
        })
    })

    it("answers none for no ids", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).activeIdsAmong("w1", [], 5)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})
