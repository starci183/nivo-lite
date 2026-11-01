import { Test } from "@nestjs/testing"
import { agentEntityOf, agentMemberOf as memberOf } from "@tests/fixtures/builders/agents.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { fakeIds, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { AgentCreationService } from "./agent-creation.service"
import { AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

const AGENT = agentEntityOf({ knowledge: "", approvalRule: "" })

const SERIAL_TAKEN = Object.assign(new Error("duplicate"), { code: "23505", constraint: "agents_workspace_serial_key" })

const agent = {
    workspaceId: "w1",
    module: "chatbot",
    name: "Bot",
    handle: "bot",
    role: "Front desk",
    instructions: "Be kind",
}

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf())) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentCreationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: IDS, useValue: fakeIds() },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(AgentCreationService), members }
}

describe("AgentCreationService", () => {
    it("adds the agent the owner named, with a generated id, for a manager", async () => {
        const em = mockEntityManager()
        const insert = fakeQueryBuilder({ execute: { raw: [AGENT] } })
        em.createQueryBuilder.mockReturnValue(insert.builder)
        const { service, members } = await build(em)

        await expect(service.create("u1", agent)).resolves.toMatchObject({ id: "a1", handle: "bot" })
        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentEntity, "ag")
        expect(insert.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "w1",
                    module: "chatbot",
                    name: "Bot",
                    serial: 10_001,
                    handle: "bot",
                    role: "Front desk",
                    instructions: "Be kind",
                },
            ],
        ])
    })

    it("names an agent given a role by that role and its generated id", async () => {
        const em = mockEntityManager()
        const insert = fakeQueryBuilder({ execute: { raw: [AGENT] } })
        em.createQueryBuilder.mockReturnValue(insert.builder)
        const { service } = await build(em)

        await service.create("u1", { ...agent, name: { label: "Accounting" } })

        expect(insert.callsOf("values")).toEqual([
            [expect.objectContaining({ name: "Agent Accounting #10001", serial: 10_001 })],
        ])
    })

    it("draws another id when the one drawn is taken in the workspace", async () => {
        const em = mockEntityManager()
        const first = fakeQueryBuilder({ execute: () => Promise.reject(SERIAL_TAKEN) })
        const second = fakeQueryBuilder({ execute: { raw: [AGENT] } })
        em.createQueryBuilder.mockReturnValueOnce(first.builder).mockReturnValueOnce(second.builder)
        const { service } = await build(em)

        await service.create("u1", { ...agent, name: { label: "Sales" } })

        expect(first.callsOf("values")).toEqual([[expect.objectContaining({ name: "Agent Sales #10001" })]])
        expect(second.callsOf("values")).toEqual([[expect.objectContaining({ name: "Agent Sales #10002" })]])
    })
})

describe("AgentCreationService failures", () => {
    it("gives up when every id it draws is taken", async () => {
        const em = mockEntityManager()
        em.createQueryBuilder.mockImplementation(
            () => fakeQueryBuilder({ execute: () => Promise.reject(SERIAL_TAKEN) }).builder,
        )
        const { service } = await build(em)

        await expect(service.create("u1", agent)).rejects.toMatchObject({ code: AgentsErrorCode.NotCreated })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(8)
    })

    it("refuses a handle another agent uses", async () => {
        const em = mockEntityManager()
        const duplicate = Object.assign(new Error("duplicate"), { code: "23505" })
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: () => Promise.reject(duplicate) }).builder)
        const { service } = await build(em)

        await expect(service.create("u1", agent)).rejects.toMatchObject({
            code: AgentsErrorCode.HandleTaken,
            params: { handle: "bot" },
        })
    })

    it.each([new Error("connection lost"), null, "connection lost", { code: "23503" }])(
        "rethrows any other database failure as it came: %p",
        async (failure) => {
            const em = mockEntityManager()
            em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: () => Promise.reject(failure) }).builder)
            const { service } = await build(em)

            await expect(service.create("u1", agent)).rejects.toBe(failure)
        },
    )

    it.each([[], undefined])("refuses when the insert answers no row (raw %p)", async (raw) => {
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: { raw } }).builder)
        const { service } = await build(em)

        await expect(service.create("u1", agent)).rejects.toMatchObject({ code: AgentsErrorCode.NotCreated })
    })
})
