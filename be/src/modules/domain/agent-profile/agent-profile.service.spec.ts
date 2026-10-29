import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentOwnershipService } from "@modules/domain/agents"
import { AuthorityRuleEntity } from "@modules/domain/authority-rules"
import type { AgentOwnership } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentProfileLogEvent } from "./agent-profile.log-events"
import { AgentProfileService } from "./agent-profile.service"
import { AgentProfileErrorCode } from "./errors/agent-profile.error"
import type { AgentHeadRead, RecentWorkRead } from "./agent-profile-reads.contracts"

const OWNERSHIP: AgentOwnership = {
    agentId: "a1",
    owner: { memberId: "m-minh", name: "Minh", role: "manager", roomId: "sales", active: true },
    fallback: { memberId: "m-nam", name: "Nam", role: "owner", roomId: null, active: true },
    responder: { ownerMemberId: "m-minh", fallbackMemberId: "m-nam" },
    assignableRoles: ["manager"],
    assignableRooms: [{ key: "sales", name: "Sales" }],
    canTag: [{ id: "a2", name: "Accounting AI", module: "accounting", status: "active" }],
}

const HEAD: AgentHeadRead = {
    id: "a1",
    name: "AI Sales",
    handle: "ai-sales",
    role: "Sales assistant",
    module: "sales",
    status: "active",
    avatarUrl: null,
    roomName: "Sales",
    operatingMode: "assist",
}

const WORK: RecentWorkRead = {
    id: "w1",
    action: "send_quote",
    status: "done",
    at: "2026-10-22T09:00:00.000Z",
    summary: "Close the group booking",
    customer: "Minh An",
    leadId: null,
}

const RULE = builder<AuthorityRuleEntity>({
    id: "r1",
    workspaceId: "w1",
    department: "sales",
    action: "send_quote",
    mode: "ask",
    limitVnd: null,
    requiredFields: [],
    note: "",
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    unit: "vnd",
    autoMax: null,
    askMax: null,
    approverRoles: ["owner", "manager"],
    approverRooms: [],
    approverMembers: [],
    approvalPolicy: "any",
    timeoutMinutes: 60,
    agents: [],
})

const build = async (entityManager: MockEntityManager) => {
    const agents = mock<AgentOwnershipService>({ ownershipOf: jest.fn(() => Promise.resolve(OWNERSHIP)) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentProfileService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: LOGGER, useValue: logger },
            { provide: AgentOwnershipService, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(AgentProfileService), agents, logger }
}

describe("AgentProfileService", () => {
    it("composes the header, the ownership, the rules of its module and its recent work", async () => {
        const em = mockEntityManager({ find: [AuthorityRuleEntity, [RULE()]] })
        const [head, recent] = queueQueryBuilders(em, [{ getRawOne: HEAD }, { getRawMany: [WORK] }])
        const { service, agents } = await build(em)

        const page = await service.page("u1", "w1", "a1")

        expect(page.agent).toMatchObject({ id: "a1", roomName: "Sales", operatingMode: "assist" })
        expect(page.ownership).toBe(OWNERSHIP)
        expect(page.rules).toEqual({
            ok: true,
            data: [{ action: "send_quote", department: "sales", mode: "ask", limitVnd: null, note: "" }],
        })
        expect(page.recent).toEqual({
            ok: true,
            data: [
                {
                    id: "w1",
                    action: "send_quote",
                    title: "Close the group booking",
                    customer: "Minh An",
                    status: "done",
                    at: "2026-10-22T09:00:00.000Z",
                    leadId: null,
                },
            ],
        })
        expect(agents.ownershipOf).toHaveBeenCalledWith("u1", "w1", "a1")
        expect(head?.callsOf("where")).toEqual([
            ["a.id = :agentId AND a.workspaceId = :workspaceId", { agentId: "a1", workspaceId: "w1" }],
        ])
        expect(em.find).toHaveBeenCalledWith(AuthorityRuleEntity, {
            where: { workspaceId: "w1", department: "sales" },
            order: { action: "ASC" },
            take: 50,
        })
        expect(recent?.callsOf("where")).toEqual([
            ["w.workspaceId = :workspaceId AND w.department = :department", { workspaceId: "w1", department: "sales" }],
        ])
        expect(recent?.callsOf("limit")).toEqual([[6]])
    })

    it("fails the rules region in place (their statement is not answered) and keeps the rest of the page", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawOne: HEAD }, { getRawMany: [] }])
        const { service, logger } = await build(em)

        const page = await service.page("u1", "w1", "a1")

        expect(page.rules).toEqual({ ok: false })
        expect(page.recent).toEqual({ ok: true, data: [] })
        expect(logger.error).toHaveBeenCalledWith(AgentProfileLogEvent.RegionFailed, expect.any(Error), {
            region: "rules",
        })
    })

    it("refuses an agent whose header cannot be read", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawOne: undefined }])
        const { service } = await build(em)

        await expect(service.page("u1", "w1", "a1")).rejects.toMatchObject({
            code: AgentProfileErrorCode.AgentNotFound,
            params: { id: "a1" },
        })
    })
})
