import { Test } from "@nestjs/testing"
import { agentMemberOf as memberOf } from "@tests/fixtures/builders/agents.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentIdentityService } from "./agent-identity.service"
import { AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf())) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentIdentityService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(AgentIdentityService), members }
}

describe("AgentIdentityService", () => {
    describe("rename", () => {
        it("keeps any free-text name the owner types, trimmed, for a manager", async () => {
            const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
            const { service, members } = await build(em)

            await service.rename("u1", "w1", "a1", "  Black   Cat  ")

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.update).toHaveBeenCalledWith(AgentEntity, { id: "a1", workspaceId: "w1" }, { name: "Black Cat" })
        })

        it.each(["", "  x  ", "y".repeat(41)])("refuses the name %p outside the length limits", async (name) => {
            const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
            const { service } = await build(em)

            await expect(service.rename("u1", "w1", "a1", name)).rejects.toMatchObject({
                code: AgentsErrorCode.NameInvalid,
                params: { min: 2, max: 40 },
            })
            expect(em.update).not.toHaveBeenCalled()
        })

        it("refuses an agent that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ update: [AgentEntity, { affected: 0 }] }))

            await expect(service.rename("u1", "w1", "ghost", "Ghost")).rejects.toMatchObject({
                code: AgentsErrorCode.AgentNotFound,
                params: { id: "ghost" },
            })
        })

        it("refuses a member who may not govern agents before writing anything", async () => {
            const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
            const { service, members } = await build(em)
            const refusal = Object.assign(new Error("not allowed"), { code: "WORKSPACE_MEMBERS_FORBIDDEN" })
            members.require.mockRejectedValueOnce(refusal)

            await expect(service.rename("u1", "w1", "a1", "Sales desk")).rejects.toBe(refusal)
            expect(em.update).not.toHaveBeenCalled()
        })
    })
})

describe("AgentIdentityService", () => {
    describe("setAvatar", () => {
        it("sets and clears the picture of an agent for a manager", async () => {
            const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
            const { service, members } = await build(em)

            await service.setAvatar("u1", "w1", "a1", "https://cdn.example/a1.png")
            await service.setAvatar("u1", "w1", "a1", null)

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.update).toHaveBeenNthCalledWith(
                1,
                AgentEntity,
                { id: "a1", workspaceId: "w1" },
                { avatarUrl: "https://cdn.example/a1.png" },
            )
            expect(em.update).toHaveBeenNthCalledWith(
                2,
                AgentEntity,
                { id: "a1", workspaceId: "w1" },
                { avatarUrl: null },
            )
        })

        it("refuses a picture that is not an HTTPS address", async () => {
            const em = mockEntityManager({ update: [AgentEntity, { affected: 1 }] })
            const { service } = await build(em)

            await expect(service.setAvatar("u1", "w1", "a1", "http://cdn.example/a1.png")).rejects.toMatchObject({
                code: AgentsErrorCode.AvatarInvalid,
            })
            expect(em.update).not.toHaveBeenCalled()
        })

        it("treats an update that reports no affected count as no agent", async () => {
            const { service } = await build(mockEntityManager({ update: [AgentEntity, {}] }))

            await expect(service.setAvatar("u1", "w1", "ghost", null)).rejects.toMatchObject({
                code: AgentsErrorCode.AgentNotFound,
            })
        })

        it("refuses a picture for an agent that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ update: [AgentEntity, { affected: 0 }] }))

            await expect(service.setAvatar("u1", "w1", "ghost", null)).rejects.toMatchObject({
                code: AgentsErrorCode.AgentNotFound,
            })
        })
    })
})
