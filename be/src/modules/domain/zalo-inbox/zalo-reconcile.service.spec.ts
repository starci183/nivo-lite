import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloReconcileService } from "./zalo-reconcile.service"

const build = async () => {
    const poll = mock<ZaloInboxPollService>()
    poll.reconcileFromJob.mockResolvedValue({ connections: 0, fetched: 0, recorded: 0, skipped: 0, failed: 0 })
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloReconcileService, { provide: ZaloInboxPollService, useValue: poll }],
    }).compile()
    return { service: moduleRef.get(ZaloReconcileService), poll }
}

describe("ZaloReconcileService", () => {
    it("reads the missed messages back for the payload, and runs no profile round (the trigger's subject carries the listed name)", async () => {
        const { service, poll } = await build()
        const payload = { workspaceId: "ws-1", connectionId: "zalo-1" }

        await service.run(payload)

        expect(poll.reconcileFromJob).toHaveBeenCalledTimes(1)
        expect(poll.reconcileFromJob).toHaveBeenCalledWith(payload)
    })
})
