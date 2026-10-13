import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { WorkItemsService } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkDrainService } from "./work-drain.service"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import { WorkEngineService } from "./work-engine.service"

const AT = "2026-10-13T10:00:00.000Z"

const build = async (workspaces: ReadonlyArray<string>, clock = new FakeClock(AT)) => {
    const items = mock<WorkItemsService>()
    items.workspacesWithQueued.mockResolvedValue(workspaces)
    const engine = mock<WorkEngineService>()
    engine.runQueued.mockResolvedValue(2)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkDrainService,
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: WorkItemsService, useValue: items },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { service: moduleRef.get(WorkDrainService), items, engine, logger }
}

describe("WorkDrainService", () => {
    it("drains each workspace with queued work as NIVO and answers how many steps ran", async () => {
        const { service, items, engine } = await build(["ws-1", "ws-2"])

        await expect(service.drainAll()).resolves.toBe(4)

        expect(items.workspacesWithQueued).toHaveBeenCalledWith(50)
        expect(engine.runQueued).toHaveBeenCalledWith({ workspaceId: "ws-1", actor: "NIVO", locale: "vi" }, 4)
        expect(engine.runQueued).toHaveBeenCalledWith({ workspaceId: "ws-2", actor: "NIVO", locale: "vi" }, 4)
    })

    it("logs a failing workspace and still drains the others", async () => {
        const { service, engine, logger } = await build(["ws-1", "ws-2"])
        const cause = new Error("down")
        engine.runQueued.mockRejectedValueOnce(cause)

        await expect(service.drainAll()).resolves.toBe(2)

        expect(logger.error).toHaveBeenCalledWith(WorkEngineLogEvent.DrainFailed, cause, { workspaceId: "ws-1" })
        expect(engine.runQueued).toHaveBeenCalledTimes(2)
    })

    it("does nothing when no workspace has queued work", async () => {
        const { service, engine } = await build([])

        await expect(service.drainAll()).resolves.toBe(0)

        expect(engine.runQueued).not.toHaveBeenCalled()
    })
})
