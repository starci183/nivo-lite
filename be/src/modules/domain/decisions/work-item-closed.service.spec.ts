import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { itemOf, owner } from "@tests/fixtures/builders/work-engine.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WORK_ITEM_CLOSED } from "@modules/domain/work-items"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import { WorkItemClosedService } from "./work-item-closed.service"
import type { WorkItemClosedHook } from "./work-engine.port"

const ctx = { workspaceId: "ws-1", actor: "Lan", locale: "en" } as const

const hook = mock<WorkItemClosedHook>()
const NO_HOOK: WorkItemClosedHook | null = null

const buildBound = async () => {
    const told: Array<string> = []
    hook.closed.mockReset()
    hook.closed.mockImplementation((workspaceId, itemId, outcome, by) => {
        told.push(`${workspaceId}:${itemId}:${outcome}:${by}`)
        return Promise.resolve()
    })
    const logger = mock<Logger>()
    const container = await Test.createTestingModule({
        providers: [
            WorkItemClosedService,
            { provide: LOGGER, useValue: logger },
            { provide: WORK_ITEM_CLOSED, useValue: hook },
        ],
    }).compile()
    return { service: container.get(WorkItemClosedService), told, logger }
}

const buildBare = async () => {
    const container = await Test.createTestingModule({
        providers: [
            WorkItemClosedService,
            { provide: WORK_ITEM_CLOSED, useValue: NO_HOOK },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return container.get(WorkItemClosedService)
}

describe("WorkItemClosedService.tell", () => {
    it("tells the hook an approval and a rejection, with the person who decided", async () => {
        const { service, told } = await buildBound()

        await service.tell(ctx, itemOf({ status: "done" }), owner)
        await service.tell(ctx, itemOf({ status: "rejected" }), { ...owner, memberId: "member-1" })

        expect(told).toEqual(["ws-1:item-1:approved:Lan", "ws-1:item-1:rejected:member-1"])
    })

    it("says nothing about an item that did not close by the decision", async () => {
        const { service, told } = await buildBound()

        await service.tell(ctx, itemOf({ status: "failed" }), owner)
        await service.tell(ctx, itemOf({ status: "waiting_decision" }), owner)

        expect(told).toEqual([])
    })

    it("lets the decision stand when the hook throws, and logs it", async () => {
        const { service, logger } = await buildBound()
        hook.closed.mockRejectedValue(new Error("db down"))

        await expect(service.tell(ctx, itemOf({ status: "done" }), owner)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(WorkEngineLogEvent.ClosedHookFailed, expect.any(Error), {
            workItemId: "item-1",
        })
    })

    it("tells nobody when nothing is bound", async () => {
        const service = await buildBare()

        await expect(service.tell(ctx, itemOf({ status: "done" }), owner)).resolves.toBeUndefined()
    })
})
