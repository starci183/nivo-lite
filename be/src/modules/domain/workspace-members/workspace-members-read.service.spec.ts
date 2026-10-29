import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMemberEntity } from "./persistence/entities"
import { WorkspaceMembersReadService } from "./workspace-members-read.service"

const memberOf = entityOf(WorkspaceMemberEntity, {
    id: "m1",
    workspaceId: "w1",
    userId: "u1",
    role: "staff",
    staffId: null,
    displayName: "An",
    status: "active",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceMembersReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkspaceMembersReadService)
}

describe("WorkspaceMembersReadService > active members", () => {
    it("counts the active members", async () => {
        const em = mockEntityManager({ count: [WorkspaceMemberEntity, 4] })

        await expect((await build(em)).activeCount("w1")).resolves.toBe(4)
        expect(em.count).toHaveBeenCalledWith(WorkspaceMemberEntity, { where: { workspaceId: "w1", status: "active" } })
    })

    it("reads the oldest active members as seats, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "u1" }] }])

        await expect((await build(em)).firstActive("w1", 4)).resolves.toEqual([{ id: "u1" }])
        expect(read?.argsOf("andWhere")).toContainEqual(["m.status = 'active'"])
        expect(read?.argsOf("orderBy")).toContainEqual(["m.createdAt"])
        expect(read?.argsOf("addOrderBy")).toContainEqual(["m.id"])
        expect(read?.argsOf("limit")).toContainEqual([4])
    })

    it("asks for no active member when no account is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).activeByUserIds("w1", [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads the active members among the given accounts once each", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "u1" }] }])

        await expect((await build(em)).activeByUserIds("w1", ["u1", "u1"])).resolves.toEqual([{ id: "u1" }])
        expect(read?.argsOf("andWhere")).toContainEqual([
            "m.status = 'active' AND m.userId IN (:...userIds)",
            { userIds: ["u1"] },
        ])
    })
})

describe("WorkspaceMembersReadService > stewards, names and directory", () => {
    it("counts the active owners and managers", async () => {
        const em = mockEntityManager({ count: [WorkspaceMemberEntity, 2] })

        await expect((await build(em)).stewardCount("w1")).resolves.toBe(2)
        expect(em.count).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            where: { workspaceId: "w1", status: "active", role: In(["owner", "manager"]) },
        })
    })

    it("reads the oldest active owners and managers as seats, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "u1" }] }])

        await expect((await build(em)).firstStewards("w1", 4)).resolves.toEqual([{ id: "u1" }])
        expect(read?.argsOf("andWhere")).toContainEqual(["m.status = 'active' AND m.role IN ('owner', 'manager')"])
        expect(read?.argsOf("limit")).toContainEqual([4])
    })

    it("asks for no name when no account is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).namesOf("w1", [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })

    it("answers the display names of the given accounts once each", async () => {
        const em = mockEntityManager({
            find: [WorkspaceMemberEntity, [memberOf()]],
        })

        await expect((await build(em)).namesOf("w1", ["u1", "u1"])).resolves.toEqual([
            { userId: "u1", displayName: "An" },
        ])
        expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { userId: true, displayName: true },
            where: { workspaceId: "w1", userId: In(["u1"]) },
            take: 1,
        })
    })

    it("lists the directory owners first, then managers, oldest first, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "m1" }] }])

        await expect((await build(em)).directory("w1", 500)).resolves.toEqual([{ id: "m1" }])
        expect(read?.argsOf("orderBy")).toContainEqual([
            "CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END",
        ])
        expect(read?.argsOf("addOrderBy")).toContainEqual(["m.createdAt", "ASC"])
        expect(read?.argsOf("limit")).toContainEqual([500])
    })

    it("proves a member row under a share lock inside the transaction", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, memberOf()] })

        await expect((await build(em)).lockMember(em, "w1", "m1")).resolves.toBe(true)
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { id: true },
            where: { id: "m1", workspaceId: "w1" },
            lock: { mode: "pessimistic_read" },
        })
    })

    it("answers false when the member is not in the workspace", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceMemberEntity, null] })

        await expect((await build(em)).lockMember(em, "w1", "m1")).resolves.toBe(false)
    })
})
