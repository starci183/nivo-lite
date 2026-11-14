import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService, AgentOwnershipService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsActivityService } from "@modules/domain/work-items"
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

const build = async (
    head: AgentHeader | null = HEAD_FACTS,
    recent: ReadonlyArray<RecentWorkRead> | Error = [],
) => {
    const activity = mock<WorkItemsActivityService>()
    if (recent instanceof Error) activity.recentOf.mockRejectedValue(recent)
    else activity.recentOf.mockResolvedValue([...recent])
    const agents = mock<AgentOwnershipService>({ ownershipOf: jest.fn(() => Promise.resolve(OWNERSHIP)) })
    const logger = mock<Logger>()
    const directory = mock<AgentDirectoryService>()
    directory.headOf.mockResolvedValue(head)
    const installations = mock<InstallationRecordsService>()
    installations.ofAgent.mockResolvedValue(installationRecordOf({ operatingMode: "assist" }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentProfileService,
            { provide: AgentDirectoryService, useValue: directory },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: LOGGER, useValue: logger },
            { provide: AgentOwnershipService, useValue: agents },
            { provide: WorkItemsActivityService, useValue: activity },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentProfileService),
        agents,
        logger,
        activity,
        directory,
        installations,
    }
}

describe("AgentProfileService", () => {
    it("composes the header, the ownership, an empty rules region and its recent work", async () => {
        const { service, agents, activity, directory } = await build(HEAD_FACTS, [WORK])

        const page = await service.page("u1", "w1", "a1")

        expect(page.agent).toMatchObject({ id: "a1", roomName: null, operatingMode: "assist" })
        expect(page.ownership).toBe(OWNERSHIP)
        expect(page.rules).toEqual({ ok: true, data: [] })
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
        expect(activity.recentOf).toHaveBeenCalledWith("w1", "sales", 6)
    })

    it("leaves the operating mode empty for an agent with no installation", async () => {
        const { service, installations } = await build(HEAD_FACTS, [WORK])
        installations.ofAgent.mockResolvedValue(null)

        const page = await service.page("u1", "w1", "a1")

        expect(page.agent.operatingMode).toBeNull()
    })

    it("fails the recent region in place and keeps the rest of the page", async () => {
        const { service, logger } = await build(HEAD_FACTS, new Error("work table missing"))

        const page = await service.page("u1", "w1", "a1")

        expect(page.recent).toEqual({ ok: false })
        expect(page.rules).toEqual({ ok: true, data: [] })
        expect(logger.error).toHaveBeenCalledWith(AgentProfileLogEvent.RegionFailed, expect.any(Error), {
            region: "recent",
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
