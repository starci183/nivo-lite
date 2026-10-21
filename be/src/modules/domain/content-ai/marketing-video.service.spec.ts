import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CommandBusService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MarketingDraft } from "./content-agent.contracts"
import { MarketingVideoService, scenesOf } from "./marketing-video.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Owner", locale: "vi" }
const DRAFT: MarketingDraft = {
    title: "A weekend",
    caption: "Relax",
    hashtags: [],
    images: [],
    script: [
        { at: "00-05s", line: "Candles and warm towels." },
        { at: "05-10s", line: "  " },
        { at: "10-15s", line: "20% off today" },
    ],
}
const IMAGES = [{ path: "ws-1/marketing/c-1/1.png", width: 1200, height: 800 }]
const BRIEF = { contentItemId: "c-1", channels: ["facebook", "zalo"], parentId: "w-1" }

const build = async (sendCommand: CommandBusService["sendCommand"]) => {
    const bus = mock<CommandBusService>({ sendCommand: jest.fn(sendCommand) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingVideoService,
            { provide: CommandBusService, useValue: bus },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(MarketingVideoService), bus, logger }
}

describe("MarketingVideoService", () => {
    it("cuts one scene per spoken beat, the draft images over the first ones", () => {
        expect(scenesOf(DRAFT, IMAGES)).toEqual([
            {
                caption: "Candles and warm towels.",
                voiceover: "Candles and warm towels.",
                media: "ws-1/marketing/c-1/1.png",
            },
            { caption: "20% off today", voiceover: "20% off today", media: null },
        ])
    })

    it("hands the script to AI Editor once per content item", async () => {
        const item = mock<WorkItem>()
        const { service, bus } = await build(() =>
            Promise.resolve({ ok: true, item, created: true, chainId: "ch-1", depth: 1 }),
        )

        await expect(service.delegate(CTX, DRAFT, IMAGES, BRIEF)).resolves.toBe(true)
        expect(bus.sendCommand).toHaveBeenCalledWith(
            CTX,
            expect.objectContaining({ to: "video", command: "render_script", dedupeKey: "render_script:c-1" }),
        )
    })

    it("titles a draft without a title as a video", async () => {
        const item = mock<WorkItem>()
        const { service, bus } = await build(() =>
            Promise.resolve({ ok: true, item, created: true, chainId: "ch-1", depth: 1 }),
        )

        await service.delegate(CTX, { ...DRAFT, title: "   " }, IMAGES, BRIEF)

        expect(bus.sendCommand.mock.calls[0]?.[1].payload).toMatchObject({ title: "Video", content_item_id: "c-1" })
    })

    it("answers false on a refusal, a failure or an empty script", async () => {
        const refused = await build(() => Promise.resolve({ ok: false, refused: "unknown_command", detail: "" }))
        await expect(refused.service.delegate(CTX, DRAFT, IMAGES, BRIEF)).resolves.toBe(false)
        expect(refused.logger.warn).toHaveBeenCalled()

        const failed = await build(() => Promise.reject(new Error("down")))
        await expect(failed.service.delegate(CTX, DRAFT, IMAGES, BRIEF)).resolves.toBe(false)
        expect(failed.logger.error).toHaveBeenCalled()

        await expect(failed.service.delegate(CTX, { ...DRAFT, script: [] }, IMAGES, BRIEF)).resolves.toBe(false)
    })
})
