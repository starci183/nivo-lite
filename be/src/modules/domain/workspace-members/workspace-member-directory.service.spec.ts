import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMemberEntity } from "./persistence/entities"
import { WorkspaceMemberDirectoryService } from "./workspace-member-directory.service"

const memberOf = entityOf(WorkspaceMemberEntity, {
    id: "m1",
    workspaceId: "w1",
    userId: "u1",
    role: "manager",
    staffId: null,
    displayName: "Mr Minh",
    status: "active",
})

const MINH = { id: "m1", displayName: "Mr Minh", role: "manager" }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceMemberDirectoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkspaceMemberDirectoryService)
}

describe("WorkspaceMemberDirectoryService", () => {
    describe("seatsOf", () => {
        it("lists the seats of a person, oldest first, bounded", async () => {
            const em = mockEntityManager({ find: [WorkspaceMemberEntity, [memberOf()]] })

            await expect((await build(em)).seatsOf("u1", 7)).resolves.toEqual([
                {
                    userId: "u1",
                    workspaceId: "w1",
                    role: "manager",
                    staffId: null,
                    displayName: "Mr Minh",
                    status: "active",
                },
            ])
            expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
                where: { userId: "u1" },
                order: { createdAt: "ASC", id: "ASC" },
                take: 7,
            })
        })
    })

    describe("holdsAny", () => {
        it("asks the own manager whether the person holds a seat", async () => {
            const em = mockEntityManager({ exists: [WorkspaceMemberEntity, true] })

            await expect((await build(em)).holdsAny("u1")).resolves.toBe(true)
            expect(em.exists).toHaveBeenCalledWith(WorkspaceMemberEntity, { where: { userId: "u1" } })
        })

        it("asks the transaction manager when one is given", async () => {
            const em = mockEntityManager()
            const tx = mockEntityManager({ exists: [WorkspaceMemberEntity, false] })

            await expect((await build(em)).holdsAny("u1", tx)).resolves.toBe(false)
            expect(em.exists).not.toHaveBeenCalled()
        })
    })

    describe("isActiveOwner", () => {
        it("asks whether the person holds an active owner seat", async () => {
            const em = mockEntityManager({ exists: [WorkspaceMemberEntity, true] })

            await expect((await build(em)).isActiveOwner("w1", "u1")).resolves.toBe(true)
            expect(em.exists).toHaveBeenCalledWith(WorkspaceMemberEntity, {
                where: { workspaceId: "w1", userId: "u1", role: "owner", status: "active" },
            })
        })
    })

    describe("firstActiveOwnerUserId", () => {
        it("answers the account of the oldest active owner", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, memberOf()] })

            await expect((await build(em)).firstActiveOwnerUserId("w1")).resolves.toBe("u1")
            expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
                select: { userId: true },
                where: { workspaceId: "w1", role: "owner", status: "active" },
                order: { createdAt: "ASC" },
            })
        })

        it("answers null when the workspace has no active owner", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, null] })

            await expect((await build(em)).firstActiveOwnerUserId("w1")).resolves.toBeNull()
        })
    })

    describe("userIdsOf", () => {
        it("asks for nothing when no workspace is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).userIdsOf([], 5)).resolves.toEqual([])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("lists each account of the workspaces once, in id order, bounded", async () => {
            const em = mockEntityManager()
            const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ user_id: "u1" }, { user_id: "u2" }] }])

            await expect((await build(em)).userIdsOf(["w1", "w2"], 5)).resolves.toEqual(["u1", "u2"])
            expect(read?.argsOf("distinct")).toContainEqual([true])
            expect(read?.argsOf("where")).toContainEqual([
                "m.workspaceId IN (:...workspaceIds)",
                { workspaceIds: ["w1", "w2"] },
            ])
            expect(read?.argsOf("orderBy")).toContainEqual(["m.userId"])
            expect(read?.argsOf("limit")).toContainEqual([5])
        })
    })

    describe("activeDirectory", () => {
        it("lists the active members by role and name, bounded", async () => {
            const em = mockEntityManager()
            const [read] = queueSubQueryBuilders(em, [{ getMany: [memberOf()] }])

            await expect((await build(em)).activeDirectory("w1", 9)).resolves.toEqual([MINH])
            expect(read?.argsOf("where")).toContainEqual([
                "m.workspaceId = :workspaceId AND m.status = 'active'",
                { workspaceId: "w1" },
            ])
            expect(read?.argsOf("addOrderBy")).toContainEqual(["m.displayName", "ASC"])
            expect(read?.argsOf("limit")).toContainEqual([9])
        })
    })

    describe("activeAmong", () => {
        it("asks for nothing when no member id is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).activeAmong("w1", [], 5)).resolves.toEqual([])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("reads the active members among the ids with the own manager", async () => {
            const em = mockEntityManager()
            const [read] = queueSubQueryBuilders(em, [{ getMany: [memberOf()] }])

            await expect((await build(em)).activeAmong("w1", ["m1"], 5)).resolves.toEqual([MINH])
            expect(read?.argsOf("where")).toContainEqual([
                "m.workspaceId = :workspaceId AND m.status = 'active' AND m.id IN (:...memberIds)",
                { workspaceId: "w1", memberIds: ["m1"] },
            ])
            expect(read?.argsOf("limit")).toContainEqual([5])
        })

        it("reads with the transaction manager when one is given", async () => {
            const em = mockEntityManager()
            const tx = mockEntityManager()
            const [read] = queueSubQueryBuilders(tx, [{ getMany: [] }])

            await expect((await build(em)).activeAmong("w1", ["m1"], 5, tx)).resolves.toEqual([])
            expect(read).toBeDefined()
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })

    describe("byIds", () => {
        it("asks for nothing when no member id is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).byIds("w1", [])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("answers the members among the ids whatever their status", async () => {
            const em = mockEntityManager({ find: [WorkspaceMemberEntity, [memberOf()]] })

            await expect((await build(em)).byIds("w1", ["m1", "m2"])).resolves.toEqual([MINH])
            expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
                select: { id: true, displayName: true, role: true },
                where: { workspaceId: "w1", id: In(["m1", "m2"]) },
                take: 2,
            })
        })
    })

    describe("idOfUser", () => {
        it("answers the membership id of the account", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, memberOf()] })

            await expect((await build(em)).idOfUser("w1", "u1")).resolves.toBe("m1")
            expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
                select: { id: true },
                where: { workspaceId: "w1", userId: "u1" },
            })
        })

        it("answers null when the account holds no seat", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, null] })

            await expect((await build(em)).idOfUser("w1", "u9")).resolves.toBeNull()
        })
    })

    describe("find", () => {
        it("answers the member by membership id, whatever its status", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, memberOf()] })

            await expect((await build(em)).find("w1", "m1")).resolves.toEqual(MINH)
            expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
                select: { id: true, displayName: true, role: true },
                where: { workspaceId: "w1", id: "m1" },
            })
        })

        it("answers null when the workspace has no such member", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, null] })

            await expect((await build(em)).find("w1", "m9")).resolves.toBeNull()
        })
    })
})
