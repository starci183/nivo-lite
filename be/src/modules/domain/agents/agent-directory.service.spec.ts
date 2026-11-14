import { Test } from "@nestjs/testing"
import { agentCreatedAt, agentEntityOf, lanAgent } from "@tests/fixtures/builders/agents.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentDirectoryService } from "./agent-directory.service"
import { AgentEntity } from "./persistence/entities"

const SELECT = { id: true, name: true, module: true }

const BOT = { id: "a1", name: "Bot", module: "chatbot" }
const LAN = { id: "a2", name: "Lan", module: "shifts" }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentDirectoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentDirectoryService)
}

describe("AgentDirectoryService > one agent and the active lists", () => {
    describe("activeOf", () => {
        it("lists the active agents of the workspace by name, bounded", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

            await expect((await build(em)).activeOf("w1", 5)).resolves.toEqual([BOT])
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                select: SELECT,
                where: { workspaceId: "w1", status: "active" },
                order: { name: "ASC" },
                take: 5,
            })
        })
    })

    describe("activeInOrder", () => {
        it("asks for nothing when no id is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).activeInOrder("w1", [], 5)).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("answers the active agents in the order of the ids, bounded", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf(), lanAgent()]] })

            await expect((await build(em)).activeInOrder("w1", ["a2", "a3", "a1"], 2)).resolves.toEqual([LAN, BOT])
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                select: SELECT,
                where: { workspaceId: "w1", status: "active", id: In(["a2", "a3", "a1"]) },
                take: 3,
            })
        })

        it("stops at the bound", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf(), lanAgent()]] })

            await expect((await build(em)).activeInOrder("w1", ["a1", "a2"], 1)).resolves.toEqual([BOT])
        })
    })

    describe("find", () => {
        it("answers the agent of the workspace, active or not", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })

            await expect((await build(em)).find("w1", "a1")).resolves.toEqual(BOT)
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                select: SELECT,
                where: { workspaceId: "w1", id: "a1" },
            })
        })

        it("answers null when the workspace has no such agent", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })

            await expect((await build(em)).find("w1", "a9")).resolves.toBeNull()
        })
    })
})

describe("AgentDirectoryService > cards and module lookups", () => {
    describe("findActive", () => {
        it("answers the active agent of the workspace", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })

            await expect((await build(em)).findActive("w1", "a1")).resolves.toEqual(BOT)
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                select: SELECT,
                where: { workspaceId: "w1", id: "a1", status: "active" },
            })
        })

        it("answers null when the agent is missing or paused", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })

            await expect((await build(em)).findActive("w1", "a1")).resolves.toBeNull()
        })
    })

    describe("cardsOf", () => {
        it("asks for nothing when no id is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).cardsOf("w1", [])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("answers the cards of the agents that exist in the workspace", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [lanAgent()]] })

            await expect((await build(em)).cardsOf("w1", ["a2", "a9"])).resolves.toEqual([LAN])
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                select: SELECT,
                where: { workspaceId: "w1", id: In(["a2", "a9"]) },
                take: 2,
            })
        })
    })

    describe("firstActiveIdOfModule", () => {
        it("answers the oldest active agent of the module", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })

            await expect((await build(em)).firstActiveIdOfModule("w1", "chatbot")).resolves.toBe("a1")
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                select: { id: true },
                where: { workspaceId: "w1", module: "chatbot", status: "active" },
                order: { createdAt: "ASC" },
            })
        })

        it("answers null when the department has no active agent", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })

            await expect((await build(em)).firstActiveIdOfModule("w1", "shifts")).resolves.toBeNull()
        })
    })
})

describe("AgentDirectoryService > handles, seats and ids", () => {
    describe("handlesOf", () => {
        it("lists the handles of every agent of the workspace, bounded", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

            await expect((await build(em)).handlesOf("w1", 9)).resolves.toEqual(["bot"])
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                select: { handle: true },
                where: { workspaceId: "w1" },
                take: 9,
            })
        })
    })
})

describe("AgentDirectoryService > handle, module count and identities", () => {
    describe("activeByHandles", () => {
        it("lists the active agents holding a handle in handle order, bounded", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

            await expect((await build(em)).activeByHandles("w1", ["bot"], 2)).resolves.toEqual([
                { id: "a1", handle: "bot", module: "chatbot", name: "Bot" },
            ])
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                select: { id: true, handle: true, module: true, name: true },
                where: { workspaceId: "w1", status: "active", handle: In(["bot"]) },
                order: { handle: "ASC" },
                take: 2,
            })
        })
    })

    describe("activeCountOfModules", () => {
        it("counts the active agents working in the modules", async () => {
            const em = mockEntityManager({ count: [AgentEntity, 3] })

            await expect((await build(em)).activeCountOfModules("w1", ["chatbot", "booking"])).resolves.toBe(3)
            expect(em.count).toHaveBeenCalledWith(AgentEntity, {
                where: { workspaceId: "w1", status: "active", module: In(["chatbot", "booking"]) },
            })
        })
    })

    describe("identitiesOf", () => {
        it("answers the name, handle and picture of the given agents", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

            await expect((await build(em)).identitiesOf("w1", ["a1", "a1"])).resolves.toEqual([
                { id: "a1", name: "Bot", handle: "bot", avatarUrl: null, avatarPreset: null },
            ])
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                select: { id: true, name: true, handle: true, avatarUrl: true, avatarPreset: true },
                where: { workspaceId: "w1", id: In(["a1"]) },
                take: 1,
            })
        })

        it("asks nothing for no ids", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).identitiesOf("w1", [])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })
    })
})

describe("AgentDirectoryService > sheets", () => {
    describe("sheets", () => {
        const SHEET_SELECT = {
            id: true,
            module: true,
            name: true,
            handle: true,
            role: true,
            instructions: true,
            knowledge: true,
            greeting: true,
            approvalRule: true,
            status: true,
            createdAt: true,
        }
        const SHEET = {
            id: "a1",
            module: "chatbot",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "Be kind",
            knowledge: "Open 9-5",
            greeting: "",
            approvalRule: "Ask first",
            status: "active",
            createdAt: new Date("2026-10-01T00:00:00.000Z"),
        }

        it("lists the whole sheets of the workspace, oldest first, bounded", async () => {
            const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

            await expect((await build(em)).sheetsOf("w1", 200)).resolves.toEqual([SHEET])
            expect(em.find).toHaveBeenCalledWith(AgentEntity, {
                select: SHEET_SELECT,
                where: { workspaceId: "w1", module: Not("nivo") },
                order: { createdAt: "ASC" },
                take: 200,
            })
        })

        it("answers the oldest agent of a module with its sheet", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })

            await expect((await build(em)).earliestSheetOfModule("w1", "chatbot")).resolves.toEqual(SHEET)
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                select: SHEET_SELECT,
                where: { workspaceId: "w1", module: "chatbot" },
                order: { createdAt: "ASC", id: "ASC" },
            })
        })

        it("answers null when the department has no agent", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })

            await expect((await build(em)).earliestSheetOfModule("w1", "chatbot")).resolves.toBeNull()
        })
    })
})

describe("AgentDirectoryService > first card and greeting", () => {
    describe("firstActiveCardOfModule", () => {
        it("answers the oldest active agent of the module", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })

            await expect((await build(em)).firstActiveCardOfModule("w1", "chatbot")).resolves.toEqual(BOT)
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                select: SELECT,
                where: { workspaceId: "w1", module: "chatbot", status: "active" },
                order: { createdAt: "ASC", id: "ASC" },
            })
        })

        it("answers null when the department has no active agent", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })

            await expect((await build(em)).firstActiveCardOfModule("w1", "accounting")).resolves.toBeNull()
        })
    })

    describe("greetingOf", () => {
        it("answers the greeting of the agent", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, Object.assign(agentEntityOf(), { greeting: "Hi" })] })

            await expect((await build(em)).greetingOf("w1", "a1")).resolves.toBe("Hi")
            expect(em.findOne).toHaveBeenCalledWith(AgentEntity, {
                select: { greeting: true },
                where: { workspaceId: "w1", id: "a1" },
            })
        })

        it("answers null when the agent is not there", async () => {
            const em = mockEntityManager({ findOne: [AgentEntity, null] })

            await expect((await build(em)).greetingOf("w1", "a1")).resolves.toBeNull()
        })
    })
})

describe("AgentDirectoryService bindings", () => {
    it("lists the active agents among the ids with their creation moments, oldest first, bounded", async () => {
        const created = new Date("2026-10-01T00:00:00.000Z")
        const em = mockEntityManager({ find: [AgentEntity, [agentCreatedAt(created)]] })

        await expect((await build(em)).activeCreatedAmong("w1", ["a1", "a1"], 200)).resolves.toEqual([
            { id: "a1", module: "chatbot", name: "Bot", createdAt: created },
        ])
        expect(em.find).toHaveBeenCalledWith(AgentEntity, {
            select: { id: true, module: true, name: true, createdAt: true },
            where: { workspaceId: "w1", status: "active", id: In(["a1"]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: 200,
        })
    })

    it("reads nothing for no ids", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).activeCreatedAmong("w1", [], 200)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })

    it("tells whether the workspace holds the agent, under a shared lock", async () => {
        const held = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })
        const missing = mockEntityManager({ findOne: [AgentEntity, null] })
        const service = await build(mockEntityManager())

        await expect(service.holds("w1", "a1", held)).resolves.toBe(true)
        await expect(service.holds("w1", "a9", missing)).resolves.toBe(false)
        expect(held.findOne).toHaveBeenCalledWith(AgentEntity, {
            select: { id: true },
            where: { id: "a1", workspaceId: "w1" },
            lock: { mode: "pessimistic_read" },
        })
    })
})

describe("AgentDirectoryService status and modules", () => {
    it("answers the status of the agent of the workspace, null for none", async () => {
        const found = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })
        const missing = mockEntityManager({ findOne: [AgentEntity, null] })

        await expect((await build(found)).statusOf("w1", "a1")).resolves.toBe("active")
        await expect((await build(missing)).statusOf("w1", "a9")).resolves.toBeNull()
    })

    it("lists the agents of the workspace with their modules, oldest first, bounded", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

        await expect((await build(em)).moduleRefsOf("w1", 500)).resolves.toEqual([{ id: "a1", module: "chatbot" }])
        expect(em.find).toHaveBeenCalledWith(AgentEntity, {
            select: { id: true, module: true },
            where: { workspaceId: "w1", module: Not("nivo") },
            order: { createdAt: "ASC", id: "ASC" },
            take: 500,
        })
    })
})

describe("AgentDirectoryService chat and turn facts", () => {
    it("answers the chat facts of the agent of the workspace, null for none", async () => {
        const found = mockEntityManager({ findOne: [AgentEntity, agentEntityOf({ greeting: "Hi" })] })
        const missing = mockEntityManager({ findOne: [AgentEntity, null] })

        await expect((await build(found)).chatFactsOf("w1", "a1")).resolves.toEqual({
            id: "a1",
            module: "chatbot",
            status: "active",
            greeting: "Hi",
            avatarUrl: null,
        })
        await expect((await build(missing)).chatFactsOf("w1", "a9")).resolves.toBeNull()
    })

    it("answers the agent of a turn with the texts that steer it, null for none", async () => {
        const found = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })
        const missing = mockEntityManager({ findOne: [AgentEntity, null] })

        await expect((await build(found)).turnFactsOf("a1")).resolves.toEqual({
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            module: "chatbot",
            instructions: "Be kind",
            knowledge: "Open 9-5",
            approvalRule: "Ask first",
            greeting: "",
        })
        await expect((await build(missing)).turnFactsOf("a9")).resolves.toBeNull()
    })

    it("answers the header of an agent of the workspace, null for none", async () => {
        const found = mockEntityManager({ findOne: [AgentEntity, agentEntityOf()] })
        const missing = mockEntityManager({ findOne: [AgentEntity, null] })

        await expect((await build(found)).headOf("w1", "a1")).resolves.toEqual({
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            module: "chatbot",
            status: "active",
            avatarUrl: null,
        })
        await expect((await build(missing)).headOf("w1", "a9")).resolves.toBeNull()
    })
})

describe("AgentDirectoryService module lookups", () => {
    it("answers the id and module of the active agents without the internal one, oldest first, bounded", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

        await expect((await build(em)).activeModuleRefsOf("w1", 100)).resolves.toEqual([{ id: "a1", module: "chatbot" }])
        expect(em.find).toHaveBeenCalledWith(AgentEntity, {
            select: { id: true, module: true },
            where: { workspaceId: "w1", status: "active", module: Not("nivo") },
            order: { createdAt: "ASC", id: "ASC" },
            take: 100,
        })
    })

    it("answers the ids of the agents serving a module, bounded", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf(), lanAgent()]] })

        await expect((await build(em)).idsOfModule("w1", "chatbot", 100)).resolves.toEqual(["a1", "a2"])
        expect(em.find).toHaveBeenCalledWith(AgentEntity, {
            select: { id: true },
            where: { workspaceId: "w1", module: "chatbot" },
            take: 100,
        })
    })

    it("answers the module and name of the active agents, oldest first, bounded", async () => {
        const em = mockEntityManager({ find: [AgentEntity, [agentEntityOf()]] })

        await expect((await build(em)).activeLensesOf("w1", 100)).resolves.toEqual([{ module: "chatbot", name: "Bot" }])
        expect(em.find).toHaveBeenCalledWith(AgentEntity, {
            select: { module: true, name: true },
            where: { workspaceId: "w1", status: "active" },
            order: { createdAt: "ASC" },
            take: 100,
        })
    })
})
