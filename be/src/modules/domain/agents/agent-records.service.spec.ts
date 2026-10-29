import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
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

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentRecordsService)
}

const upsertOf = (raw: ReadonlyArray<{ id: string }>) => {
    const em = mockEntityManager()
    const upsert = fakeQueryBuilder({ execute: { raw } })
    em.createQueryBuilder.mockReturnValue(upsert.builder)
    return { em, upsert }
}

describe("AgentRecordsService", () => {
    describe("ensureByHandle", () => {
        it("upserts the agent by its handle and answers the id", async () => {
            const { em, upsert } = upsertOf([{ id: "a1" }])

            await expect((await build(em)).ensureByHandle(AGENT)).resolves.toBe("a1")
            expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentEntity, "agents")
            expect(upsert.callsOf("values")).toEqual([
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
            expect(upsert.callsOf("returning")).toEqual([["id"]])
        })

        it("refuses when the upsert answered no row", async () => {
            const { em } = upsertOf([])

            await expect((await build(em)).ensureByHandle(AGENT)).rejects.toMatchObject({
                code: AgentsErrorCode.NotCreated,
            })
        })
    })

    describe("the conflict clause", () => {
        const BLOCK = "'### NIVO setup v.*?### end NIVO setup'"
        const conflictOf = async (): Promise<string> => {
            const { em, upsert } = upsertOf([{ id: "a1" }])
            await (await build(em)).ensureByHandle(AGENT)
            return String(upsert.callsOf("onConflict")[0]?.[0])
        }

        it("updates a known handle on the workspace and handle pair", async () => {
            expect(await conflictOf()).toContain('("workspace_id", "handle") DO UPDATE')
        })

        it("keeps the setup block of a known agent and appends it once after the given text", async () => {
            const conflict = await conflictOf()
            expect(conflict).toContain(`substring("agents"."instructions" from ${BLOCK})`)
            expect(conflict.split('"agents"."instructions"').length - 1).toBe(1)
        })

        it("takes the given text alone when the known agent has no block", async () => {
            expect(await conflictOf()).toContain("concat_ws(")
        })

        it("drops any block in the given text, so a re-run leaves exactly one block", async () => {
            expect(await conflictOf()).toContain(`regexp_replace(EXCLUDED."instructions", ${BLOCK}, '', 'g')`)
        })
    })
})
