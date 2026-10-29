import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { FindOperator } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MemberLookupService } from "./member-lookup.service"
import { WorkspaceMemberEntity } from "./persistence/entities"

const member = (): WorkspaceMemberEntity =>
    Object.assign(new WorkspaceMemberEntity(), { id: "m-1", userId: "u-1", displayName: "Lan" })

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MemberLookupService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { lookup: moduleRef.get(MemberLookupService), em }
}

describe("MemberLookupService", () => {
    describe("ownersAndManagers", () => {
        it("lists the active owners and managers, bounded", async () => {
            const { lookup, em } = await build()
            const fakes = queueQueryBuilders(em, [{ getMany: [member()] }])

            await expect(lookup.ownersAndManagers("ws-1", 50)).resolves.toEqual([{ userId: "u-1", displayName: "Lan" }])

            expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceMemberEntity, "m")
            expect(fakes[0]?.callsOf("limit")).toEqual([[50]])
        })
    })

    describe("activeById", () => {
        it("answers the active member of the workspace, or null", async () => {
            const found = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, member()] }))
            const missing = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, null] }))

            await expect(found.lookup.activeById("ws-1", "m-1")).resolves.toEqual({ id: "m-1", displayName: "Lan" })
            await expect(missing.lookup.activeById("ws-1", "m-1")).resolves.toBeNull()
            expect(found.em.findOne).toHaveBeenCalledWith(WorkspaceMemberEntity, {
                select: { id: true, displayName: true },
                where: { workspaceId: "ws-1", id: "m-1", status: "active" },
            })
        })
    })

    describe("byId", () => {
        it("answers the member by membership id, or null", async () => {
            const found = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, member()] }))
            const missing = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, null] }))

            await expect(found.lookup.byId("m-1")).resolves.toEqual({ id: "m-1", displayName: "Lan" })
            await expect(missing.lookup.byId("m-1")).resolves.toBeNull()
        })
    })

    describe("activeNamed", () => {
        it("answers the oldest active member with the name ignoring case, or null", async () => {
            const found = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, member()] }))
            const missing = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, null] }))

            await expect(found.lookup.activeNamed("ws-1", "lan")).resolves.toEqual({ id: "m-1", displayName: "Lan" })
            await expect(missing.lookup.activeNamed("ws-1", "lan")).resolves.toBeNull()
            expect(found.em.findOne).toHaveBeenCalledWith(
                WorkspaceMemberEntity,
                expect.objectContaining({ order: { createdAt: "ASC", id: "ASC" } }),
            )
        })

        it("compares the display name in lower case", async () => {
            const { lookup, em } = await build(mockEntityManager({ findOne: [WorkspaceMemberEntity, member()] }))

            await lookup.activeNamed("ws-1", "Lan")

            const options = em.findOne.mock.calls[0]?.[1] as { where: { displayName: FindOperator<string> } }
            expect(options.where.displayName.getSql?.("name_col")).toBe("lower(name_col) = lower(:name)")
        })
    })
})
