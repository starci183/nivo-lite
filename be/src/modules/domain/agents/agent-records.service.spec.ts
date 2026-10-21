import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentRecordsService } from "./agent-records.service"
import type { NewAgent } from "./agents.contracts"
import { AgentsErrorCode } from "./errors/agents.error"
import { UPSERT_AGENT_BY_HANDLE } from "./persistence/agent-records.sql"

const AGENT: NewAgent = {
    workspaceId: "w1",
    module: "chatbot",
    name: "Front Desk",
    handle: "front-desk",
    role: "Answers guests",
    instructions: "Check availability first",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentRecordsService)
}

describe("AgentRecordsService", () => {
    describe("ensureByHandle", () => {
        it("upserts the agent by its handle and answers the id", async () => {
            const em = mockEntityManager({ query: [UPSERT_AGENT_BY_HANDLE, [{ id: "a1" }]] })

            await expect((await build(em)).ensureByHandle(AGENT)).resolves.toBe("a1")
            expect(em.query).toHaveBeenCalledWith(UPSERT_AGENT_BY_HANDLE, [
                "w1",
                "chatbot",
                "Front Desk",
                "front-desk",
                "Answers guests",
                "Check availability first",
            ])
        })

        it("refuses when the upsert answered no row", async () => {
            const em = mockEntityManager({ query: [UPSERT_AGENT_BY_HANDLE, []] })

            await expect((await build(em)).ensureByHandle(AGENT)).rejects.toMatchObject({
                code: AgentsErrorCode.NotCreated,
            })
        })
    })

    describe("the upsert statement", () => {
        const BLOCK = "'### NIVO setup v.*?### end NIVO setup'"

        it("inserts a new agent with the given instructions as they are", () => {
            expect(UPSERT_AGENT_BY_HANDLE).toContain("VALUES ($1, $2, $3, $4, $5, $6)")
        })

        it("keeps the setup block of a known agent and appends it once after the given text", () => {
            expect(UPSERT_AGENT_BY_HANDLE).toContain(`substring(agents.instructions from ${BLOCK})`)
            expect(UPSERT_AGENT_BY_HANDLE.split("agents.instructions").length - 1).toBe(1)
        })

        it("takes the given text alone when the known agent has no block", () => {
            expect(UPSERT_AGENT_BY_HANDLE).toContain("concat_ws(")
        })

        it("drops any block in the given text, so a re-run leaves exactly one block", () => {
            expect(UPSERT_AGENT_BY_HANDLE).toContain(`regexp_replace(excluded.instructions, ${BLOCK}, '', 'g')`)
        })
    })
})
