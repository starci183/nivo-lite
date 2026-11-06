import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { OfficeLinesService } from "./office-lines.service"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { OfficeInboundStopReporterService } from "./office-inbound-stop-reporter.service"

const STOP = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    chainId: "chain-1",
    depth: 4,
    agentIds: ["agent-0", "agent-1"],
    reason: "depth_limit",
    adapter: "tag",
    eventType: "tag",
    idempotencyKey: "k-1",
} as const

const build = async () => {
    const lines = mock<OfficeLinesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const catalog = mock<MessageCatalog>({ get: jest.fn().mockReturnValue("The chain stopped.") })
    const container = await Test.createTestingModule({
        providers: [
            OfficeInboundStopReporterService,
            { provide: OfficeLinesService, useValue: lines },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: container.get(OfficeInboundStopReporterService), lines, catalog }
}

describe("OfficeInboundStopReporterService.report", () => {
    it("says the stop once in the main room as the agent that was not woken, in the transaction of the delivery", async () => {
        const manager = mockEntityManager()
        const { service, lines, catalog } = await build()

        await expect(service.report(manager, STOP)).resolves.toBeUndefined()

        expect(catalog.get).toHaveBeenCalledWith(
            "agentInbound.chainStopped",
            { depth: 4, reason: "depth_limit", eventType: "tag" },
            "vi",
        )
        expect(lines.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1" },
            {
                body: "The chain stopped.",
                lead_id: null,
                work_item_id: null,
                room: null,
                agent_id: "agent-1",
                unlessSaidSince: new Date(0),
            },
            manager,
        )
    })
})
