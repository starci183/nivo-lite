import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunCancelService } from "@modules/domain/agent-runs"
import { StopDoorService } from "@modules/domain/agent-threads/stops"
import type { Principal } from "@modules/platform/cqrs"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CancelAgentRunCommand } from "./cancel-agent-run.command"
import { CancelAgentRunHandler } from "./cancel-agent-run.handler"

const COMMAND = new CancelAgentRunCommand({ request: { workspaceId: "ws-1", runId: "run-1" }, principal: { id: "user-1" } as Principal })

const OWNER_REQUEST = { principalId: "user-1", workspaceId: "ws-1", runId: "run-1" }

const build = async (withStops: boolean) => {
    const cancels = mock<AgentRunCancelService>({ cancel: jest.fn().mockResolvedValue({ kind: "cancelled", note: "effects_kept" }) })
    const stops = mock<StopDoorService>({ cancelRun: jest.fn().mockResolvedValue({ kind: "not_cancellable", note: null }) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CancelAgentRunHandler,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentRunCancelService, useValue: cancels },
            ...(withStops ? [{ provide: StopDoorService, useValue: stops }] : []),
        ],
    }).compile()
    return { handler: moduleRef.get(CancelAgentRunHandler), cancels, stops }
}

describe("CancelAgentRunHandler", () => {
    it("cancels through the stop door in an app that runs threads (a thread run's Cancel is its stop's skip)", async () => {
        const { handler, cancels, stops } = await build(true)

        await expect(handler.execute(COMMAND)).resolves.toEqual({ kind: "not_cancellable", note: null })
        expect(stops.cancelRun).toHaveBeenCalledWith(OWNER_REQUEST)
        expect(cancels.cancel).not.toHaveBeenCalled()
    })

    it("cancels through the owner door of the runs in an app that runs no thread", async () => {
        const { handler, cancels } = await build(false)

        await expect(handler.execute(COMMAND)).resolves.toEqual({ kind: "cancelled", note: "effects_kept" })
        expect(cancels.cancel).toHaveBeenCalledWith(OWNER_REQUEST)
    })
})
