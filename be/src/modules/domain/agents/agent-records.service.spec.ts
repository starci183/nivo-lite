import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { agentHoldingInstructions } from "@tests/fixtures/builders/agents.builder"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentRecordsService } from "./agent-records.service"
import type { NewAgent } from "./agents.contracts"
import { AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

const AGENT: NewAgent = {
    workspaceId: "w1",
    module: "chatbot",
    name: "Front Desk",
    handle: "front-desk",
    role: "Answers guests",
    instructions: "Check availability first",
}

const BLOCK = "### NIVO setup v2\nBe brief.\n### end NIVO setup"

/** What the insert answers and the row a known handle already holds. */
interface Scenario {
    readonly inserted: unknown
    readonly stored?: AgentEntity | null
}

const build = async (scenario: Scenario) => {
    const em = mockEntityManager({
        findOne: [AgentEntity, scenario.stored ?? null],
        update: [AgentEntity, { affected: 1 }],
    })
    fakeTransaction(em)
    const insert = fakeQueryBuilder({ execute: { raw: scenario.inserted } })
    em.createQueryBuilder.mockReturnValue(insert.builder)
    const moduleRef = await Test.createTestingModule({
        providers: [AgentRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(AgentRecordsService), em, insert }
}

describe("AgentRecordsService > ensureByHandle", () => {
    it("inserts a new agent by its handle and answers the id without touching a row", async () => {
        const { service, em, insert } = await build({ inserted: [{ id: "a1" }] })

        await expect(service.ensureByHandle(AGENT)).resolves.toBe("a1")
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentEntity, "agents")
        expect(insert.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "w1",
                    module: "chatbot",
                    name: "Front Desk",
                    handle: "front-desk",
                    role: "Answers guests",
                    instructions: "Check availability first",
                },
            ],
        ])
        expect(insert.callsOf("orIgnore")).toEqual([[]])
        expect(em.findOne).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it("locks the known agent and takes the given fields, keeping its setup block once after the given text", async () => {
        const stored = agentHoldingInstructions(`Old text\n\n${BLOCK}`)
        const { service, em } = await build({ inserted: [], stored })

        await expect(service.ensureByHandle({ ...AGENT, instructions: `New text\n\n\n\n${BLOCK}\n` })).resolves.toBe(
            "a9",
        )
        expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
            where: { workspaceId: "w1", handle: "front-desk" },
            lock: { mode: "pessimistic_write" },
        })
        expect(em.update).toHaveBeenCalledWith(
            AgentEntity,
            { id: "a9" },
            { module: "chatbot", name: "Front Desk", role: "Answers guests", instructions: `New text\n\n${BLOCK}` },
        )
    })

    it("takes the given text alone when the known agent has no block", async () => {
        const stored = agentHoldingInstructions("Plain")
        const { service, em } = await build({ inserted: [], stored })

        await service.ensureByHandle(AGENT)

        expect(em.update).toHaveBeenCalledWith(
            AgentEntity,
            { id: "a9" },
            expect.objectContaining({ instructions: "Check availability first" }),
        )
    })

    it("keeps only the block when the given text is empty", async () => {
        const stored = agentHoldingInstructions(BLOCK)
        const { service, em } = await build({ inserted: [], stored })

        await service.ensureByHandle({ ...AGENT, instructions: "  \n" })

        expect(em.update).toHaveBeenCalledWith(
            AgentEntity,
            { id: "a9" },
            expect.objectContaining({ instructions: BLOCK }),
        )
    })

    it("refuses when the insert was ignored and no row holds the handle", async () => {
        const { service } = await build({ inserted: [], stored: null })

        await expect(service.ensureByHandle(AGENT)).rejects.toMatchObject({ code: AgentsErrorCode.NotCreated })
    })

    it("refuses when the insert answered no row list at all", async () => {
        const { service } = await build({ inserted: undefined, stored: null })

        await expect(service.ensureByHandle(AGENT)).rejects.toMatchObject({ code: AgentsErrorCode.NotCreated })
    })
})
