import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { OfficeLinesService } from "@modules/domain/messages"
import { OfficeBackgroundVoiceService } from "./office-background-voice.service"

const WAKE_AT = new Date("2026-11-10T03:00:00.000Z")

const build = async () => {
    const lines = mock<OfficeLinesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [OfficeBackgroundVoiceService, { provide: OfficeLinesService, useValue: lines }],
    }).compile()
    return { service: container.get(OfficeBackgroundVoiceService), lines }
}

describe("OfficeBackgroundVoiceService.say", () => {
    it("says the line in the main room as the agent, unless the same words were said since the wake was written", async () => {
        const { service, lines } = await build()

        await expect(
            service.say({
                workspaceId: "ws-1",
                agentId: "agent-1",
                wakeId: "wake-1",
                wakeCreatedAt: WAKE_AT,
                text: "Two invoices are due.",
            }),
        ).resolves.toBeUndefined()

        expect(lines.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1" },
            {
                body: "Two invoices are due.",
                lead_id: null,
                work_item_id: null,
                room: null,
                agent_id: "agent-1",
                unlessSaidSince: WAKE_AT,
            },
        )
    })
})
