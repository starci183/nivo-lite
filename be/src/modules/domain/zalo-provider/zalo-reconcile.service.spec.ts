import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloProfileService } from "./zalo-profile.service"
import { ZaloReconcileService } from "./zalo-reconcile.service"

const build = async () => {
    const order: Array<string> = []
    const poll = mock<ZaloInboxPollService>()
    poll.reconcileFromJob.mockImplementation(() => {
        order.push("poll")
        return Promise.resolve({ connections: 0, fetched: 0, recorded: 0, skipped: 0, failed: 0 })
    })
    const profiles = mock<ZaloProfileService>()
    profiles.refreshFromJob.mockImplementation(() => {
        order.push("profiles")
        return Promise.resolve({ read: 0, failed: 0 })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloReconcileService,
            { provide: ZaloInboxPollService, useValue: poll },
            { provide: ZaloProfileService, useValue: profiles },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloReconcileService), poll, profiles, order }
}

describe("ZaloReconcileService", () => {
    it("reads the missed messages back first and then names the customers, both for the same payload", async () => {
        const { service, poll, profiles, order } = await build()
        const payload = { workspaceId: "ws-1", connectionId: "zalo-1" }

        await service.run(payload)

        expect(order).toEqual(["poll", "profiles"])
        expect(poll.reconcileFromJob).toHaveBeenCalledWith(payload)
        expect(profiles.refreshFromJob).toHaveBeenCalledWith(payload)
    })
})
