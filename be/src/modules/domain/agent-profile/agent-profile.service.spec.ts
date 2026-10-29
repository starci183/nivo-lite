import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService, AgentOwnershipService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { DepartmentRuleLine } from "@modules/domain/authority-rules"
import type { AgentHeader, AgentOwnership } from "@modules/domain/agents"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { installationRecordOf } from "@tests/fixtures/builders/module-install.builder"
import { AgentProfileLogEvent } from "./agent-profile.log-events"
import { AgentProfileService } from "./agent-profile.service"
import { AgentProfileErrorCode } from "./errors/agent-profile.error"
import type { RecentWorkRead } from "./agent-profile-reads.contracts"

const OWNERSHIP: AgentOwnership = {
    agentId: "a1",
    owner: { memberId: "m-minh", name: "Minh", role: "manager", roomId: "sales", active: true },
    fallback: { memberId: "m-nam", name: "Nam", role: "owner", roomId: null, active: true },
    responder: { ownerMemberId: "m-minh", fallbackMemberId: "m-nam" },
    assignableRoles: ["manager"],
    assignableRooms: [{ key: "sales", name: "Sales" }],
    canTag: [{ id: "a2", name: "Accounting AI", module: "accounting", status: "active" }],
}

const HEAD_FACTS: AgentHeader = {
    id: "a1",
    name: "AI Sales",
    handle: "ai-sales",
    role: "Sales assistant",
    module: "sales",
    status: "active",
    avatarUrl: null,
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

const RULE: DepartmentRuleLine = {
    action: "send_quote",
    department: "sales",
    mode: "ask",
    limitVnd: null,
    note: "",
}

const build = async (
    head: AgentHeader | null = HEAD_FACTS,
    recent: ReadonlyArray<RecentWorkRead> = [],
    rules: ReadonlyArray<DepartmentRuleLine> | Error = new Error("rules table missing"),
) => {
    const authority = mock<AuthorityRulesService>()
    if (rules instanceof Error) authority.departmentRules.mockRejectedValue(rules)
    else authority.departmentRules.mockResolvedValue([...rules])
    const activity = mock<WorkItemsActivityService>()
    activity.recentOf.mockResolvedValue([...recent])
    const agents = mock<AgentOwnershipService>({ ownershipOf: jest.fn(() => Promise.resolve(OWNERSHIP)) })
    const logger = mock<Logger>()
    const directory = mock<AgentDirectoryService>()
    directory.headOf.mockResolvedValue(head)
    const rooms = mock<OfficeRoomDirectoryService>()
    rooms.homeRoomNameOf.mockResolvedValue("Sales")
    const installations = mock<InstallationRecordsService>()
    installations.ofAgent.mockResolvedValue(installationRecordOf({ operatingMode: "assist" }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentProfileService,
            { provide: AgentDirectoryService, useValue: directory },
            { provide: OfficeRoomDirectoryService, useValue: rooms },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: LOGGER, useValue: logger },
            { provide: AgentOwnershipService, useValue: agents },
            { provide: WorkItemsActivityService, useValue: activity },
            { provide: AuthorityRulesService, useValue: authority },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentProfileService),
        agents,
        logger,
        activity,
        authority,
        directory,
        rooms,
        installations,
    }
}

describe("AgentProfileService", () => {
    it("composes the header, the ownership, the rules of its module and its recent work", async () => {
        const { service, agents, activity, authority, directory } = await build(HEAD_FACTS, [WORK], [RULE])

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
        expect(directory.headOf).toHaveBeenCalledWith("w1", "a1")
        expect(authority.departmentRules).toHaveBeenCalledWith("w1", "sales", 50)
        expect(activity.recentOf).toHaveBeenCalledWith("w1", "sales", 6)
    })

    it("fails the rules region in place (their statement is not answered) and keeps the rest of the page", async () => {
        const { service, logger } = await build()

        const page = await service.page("u1", "w1", "a1")

        expect(page.rules).toEqual({ ok: false })
        expect(page.recent).toEqual({ ok: true, data: [] })
        expect(logger.error).toHaveBeenCalledWith(AgentProfileLogEvent.RegionFailed, expect.any(Error), {
            region: "rules",
        })
    })

    it("refuses an agent whose header cannot be read", async () => {
        const { service } = await build(null)

        await expect(service.page("u1", "w1", "a1")).rejects.toMatchObject({
            code: AgentProfileErrorCode.AgentNotFound,
            params: { id: "a1" },
        })
    })
})
