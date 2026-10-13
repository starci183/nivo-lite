import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessagesScope, OfficeLineInput, OptionalAgentIdentity } from "./office-lines.contracts"
import { AGENT_DIRECTORY } from "./office-lines.decorators"
import type { AgentDirectory } from "./office-lines.port"
import { OfficeLinesService } from "./office-lines.service"
import { INSERT_MESSAGE } from "./persistence/office-lines.sql"

const ctx: MessagesScope = { workspaceId: "ws-1" }

const lineOf = builder<OfficeLineInput>({ body: "Followed up", lead_id: "lead-1", work_item_id: "item-1" })

const build = async (entityManager: MockEntityManager, agent: OptionalAgentIdentity) => {
    const directory = mock<AgentDirectory>({ agentOfDepartment: jest.fn().mockResolvedValue(agent) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeLinesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AGENT_DIRECTORY, useValue: directory },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeLinesService), directory }
}

describe("OfficeLinesService", () => {
    it("speaks as the department's agent when it is installed", async () => {
        const em = mockEntityManager({ query: [INSERT_MESSAGE, []] })
        const { service, directory } = await build(em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.post(ctx, lineOf({ dept: "sales", installation_id: "inst-1" }))).resolves.toBeUndefined()

        expect(directory.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", "inst-1")
        expect(em.query.mock.calls).toEqual([
            [INSERT_MESSAGE, ["ws-1", "agent", "Sales Agent", "agent-1", "Followed up", "lead-1", "item-1"]],
        ])
    })

    it("asks for the department's first agent when no instance is named", async () => {
        const { service, directory } = await build(mockEntityManager({ query: [INSERT_MESSAGE, []] }), null)

        await expect(service.post(ctx, lineOf({ dept: "sales" }))).resolves.toBeUndefined()

        expect(directory.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", null)
    })

    it("stays a NIVO line when the department has no agent", async () => {
        const em = mockEntityManager({ query: [INSERT_MESSAGE, []] })
        const { service } = await build(em, null)

        await expect(service.post(ctx, lineOf({ dept: "sales" }))).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([
            [INSERT_MESSAGE, ["ws-1", "system", "NIVO", null, "Followed up", "lead-1", "item-1"]],
        ])
    })

    it("stays a NIVO line when no department speaks", async () => {
        const em = mockEntityManager({ query: [INSERT_MESSAGE, []] })
        const { service, directory } = await build(em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.post(ctx, lineOf({ lead_id: null, work_item_id: null }))).resolves.toBeUndefined()

        expect(directory.agentOfDepartment).not.toHaveBeenCalled()
        expect(em.query.mock.calls).toEqual([
            [INSERT_MESSAGE, ["ws-1", "system", "NIVO", null, "Followed up", null, null]],
        ])
    })

    it("posts a command mirror as the bus, never as the receiving agent", async () => {
        const em = mockEntityManager({ query: [INSERT_MESSAGE, []] })
        const { service, directory } = await build(em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.post(ctx, lineOf({ dept: "sales", command: true }))).resolves.toBeUndefined()

        expect(directory.agentOfDepartment).not.toHaveBeenCalled()
        expect(em.query.mock.calls).toEqual([
            [INSERT_MESSAGE, ["ws-1", "system", "NIVO Bus", null, "Followed up", "lead-1", "item-1"]],
        ])
    })
})
