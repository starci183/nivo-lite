import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { DoorApi, DoorCallResult } from "@nivo-lite/agent-sdk/mutation"
import { ChatProfilesService } from "@modules/domain/chat-records"
import { PollLimiterService } from "@modules/domain/connection-poll"
import { ConnectionsService } from "@modules/domain/connections"
import type { HealthCandidate } from "@modules/domain/connections"
import { EngineDoorService } from "@modules/domain/entity-engine-door"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"
import { ZaloProfileService } from "./zalo-profile.service"
import { ZaloProviderLogEvent } from "./zalo-provider.log-events"

const NOW = "2026-11-07T10:00:00.000Z"
const LIMITS = { ratePerSecond: 2, burst: 4, concurrency: 2 }
const JOB = { workspaceId: "ws-1", connectionId: "zalo-1" }

const candidate = (id: string, provider = "zalo_oa", status = "connected"): HealthCandidate =>
    mock<HealthCandidate>({ id, workspaceId: "ws-1", provider, status })

const named = (name: string): DoorCallResult => ({
    ok: true,
    output: { name, avatarUrl: `https://zalo.test/${name}.png` },
})

interface Binding {
    readonly effectKey: (step: string) => string
    readonly scopeOpen: () => boolean
}

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.healthBatch.mockResolvedValue([])
    const profiles = mock<ChatProfilesService>()
    profiles.due.mockResolvedValue([])
    profiles.record.mockResolvedValue(undefined)
    profiles.tried.mockResolvedValue(undefined)
    const bindings: Array<Binding> = []
    const call = jest.fn<ReturnType<DoorApi["call"]>, Parameters<DoorApi["call"]>>()
    call.mockResolvedValue(named("Minh"))
    const door = mock<EngineDoorService>()
    door.doorApi.mockImplementation((binding) => {
        bindings.push(binding)
        return { call }
    })
    const limiter = mock<PollLimiterService>()
    limiter.pass.mockResolvedValue(undefined)
    const poller = mock<ZaloInboxPollerService>({ provider: "zalo_oa", limits: LIMITS })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloProfileService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionsService, useValue: connections },
            { provide: ChatProfilesService, useValue: profiles },
            { provide: EngineDoorService, useValue: door },
            { provide: PollLimiterService, useValue: limiter },
            { provide: ZaloInboxPollerService, useValue: poller },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloProfileService), connections, profiles, door, call, bindings, limiter, logger }
}

describe("ZaloProfileService: one connection", () => {
    it("asks for the owed customers with the cuts and the batch, reads each through the door under its own key and keeps the answer", async () => {
        const { service, profiles, call, bindings, limiter } = await build()
        profiles.due.mockResolvedValue([
            { id: "conv-1", externalId: "u-1" },
            { id: "conv-2", externalId: "u-2" },
        ])
        call.mockResolvedValueOnce(named("Minh")).mockResolvedValueOnce(named("Lan"))

        await expect(service.refreshFromJob(JOB)).resolves.toEqual({ read: 2, failed: 0 })

        expect(profiles.due).toHaveBeenCalledWith("ws-1", {
            connectionId: "zalo-1",
            refreshedBefore: new Date("2026-10-31T10:00:00.000Z"),
            triedBefore: new Date("2026-11-07T09:00:00.000Z"),
            limit: 10,
        })
        expect(limiter.pass).toHaveBeenCalledTimes(2)
        expect(limiter.pass).toHaveBeenCalledWith("zalo_oa", "zalo-1", LIMITS)
        expect(call.mock.calls).toEqual([
            ["chat.profile", { conversationId: "conv-1" }],
            ["chat.profile", { conversationId: "conv-2" }],
        ])
        expect(bindings.map((binding) => binding.effectKey("chat.profile"))).toEqual([
            "zalo-profile:conv-1:chat.profile",
            "zalo-profile:conv-2:chat.profile",
        ])
        expect(bindings[0]?.scopeOpen()).toBe(false)
        expect(profiles.record).toHaveBeenNthCalledWith(
            1,
            "ws-1",
            "conv-1",
            { name: "Minh", avatarUrl: "https://zalo.test/Minh.png" },
            new Date(NOW),
        )
        expect(profiles.record).toHaveBeenNthCalledWith(
            2,
            "ws-1",
            "conv-2",
            { name: "Lan", avatarUrl: "https://zalo.test/Lan.png" },
            new Date(NOW),
        )
        expect(profiles.tried).not.toHaveBeenCalled()
    })
})

describe("ZaloProfileService: what goes wrong", () => {
    it("keeps a failed read as a try only, logs why, and reads the next customer", async () => {
        const { service, profiles, call, logger } = await build()
        profiles.due.mockResolvedValue([
            { id: "conv-1", externalId: "u-1" },
            { id: "conv-2", externalId: "u-2" },
            { id: "conv-3", externalId: "u-3" },
        ])
        call.mockResolvedValueOnce({ ok: false, reason: "failed", message: "tool_error" })
        call.mockResolvedValueOnce({ ok: true, output: { name: 7 } })
        call.mockResolvedValueOnce(named("Lan"))

        await expect(service.refreshFromJob(JOB)).resolves.toEqual({ read: 1, failed: 2 })

        expect(profiles.tried).toHaveBeenCalledTimes(2)
        expect(profiles.tried).toHaveBeenCalledWith("ws-1", "conv-1", new Date(NOW))
        expect(profiles.tried).toHaveBeenCalledWith("ws-1", "conv-2", new Date(NOW))
        expect(profiles.record).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(ZaloProviderLogEvent.ProfileFailed, {
            conversationId: "conv-1",
            reason: "failed",
        })
        expect(logger.warn).toHaveBeenCalledWith(ZaloProviderLogEvent.ProfileFailed, {
            conversationId: "conv-2",
            reason: "unreadable_answer",
        })
    })

    it("stops the round where the limit or the door gives out, keeps what it read, and logs it", async () => {
        const { service, profiles, call, limiter, logger } = await build()
        profiles.due.mockResolvedValue([
            { id: "conv-1", externalId: "u-1" },
            { id: "conv-2", externalId: "u-2" },
            { id: "conv-3", externalId: "u-3" },
        ])
        limiter.pass.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("deferred"))

        await expect(service.refreshFromJob(JOB)).resolves.toEqual({ read: 1, failed: 0 })

        expect(call).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(ZaloProviderLogEvent.ProfileRoundStopped, expect.any(Error), {
            connectionId: "zalo-1",
        })
    })

    it("reads nobody when no customer owes a profile", async () => {
        const { service, call, logger } = await build()

        await expect(service.refreshFromJob(JOB)).resolves.toEqual({ read: 0, failed: 0 })

        expect(call).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(ZaloProviderLogEvent.ProfilesDone, { read: 0, failed: 0 })
    })
})

describe("ZaloProfileService: every connection", () => {
    it("reads nobody when the workspace holds no connection", async () => {
        const { service, profiles } = await build()

        await expect(service.refreshFromJob({})).resolves.toEqual({ read: 0, failed: 0 })

        expect(profiles.due).not.toHaveBeenCalled()
    })

    it("scans the connections, rounds the live Zalo ones only, and goes on to the next page of a full one", async () => {
        const { service, connections, profiles } = await build()
        const full = Array.from({ length: 200 }, (_value, index) => candidate(`tg-${index}`, "telegram"))
        connections.healthBatch
            .mockResolvedValueOnce(full)
            .mockResolvedValueOnce([
                candidate("zalo-1"),
                candidate("zalo-2", "zalo_oa", "disconnected"),
                candidate("tg-x", "telegram"),
            ])
        profiles.due.mockResolvedValue([{ id: "conv-1", externalId: "u-1" }])

        await expect(service.refreshFromJob({})).resolves.toEqual({ read: 1, failed: 0 })

        expect(connections.healthBatch).toHaveBeenNthCalledWith(1, "", 200)
        expect(connections.healthBatch).toHaveBeenNthCalledWith(2, "tg-199", 200)
        expect(profiles.due).toHaveBeenCalledTimes(1)
        expect(profiles.due).toHaveBeenCalledWith("ws-1", expect.objectContaining({ connectionId: "zalo-1" }))
    })
})

describe("ZaloProfileService: what is not a round", () => {
    it.each([
        ["a string", "reconcile"],
        ["null", null],
        ["a payload naming a workspace only", { workspaceId: "ws-1" }],
    ])("reads nobody for %s", async (_name, payload) => {
        const { service, connections, profiles } = await build()

        await expect(service.refreshFromJob(payload)).resolves.toEqual({ read: 0, failed: 0 })

        expect(connections.healthBatch).not.toHaveBeenCalled()
        expect(profiles.due).not.toHaveBeenCalled()
    })

    it("logs a round that fails as a whole and answers that nothing was done", async () => {
        const { service, profiles, logger } = await build()
        profiles.due.mockRejectedValue(new Error("db down"))

        await expect(service.refreshFromJob(JOB)).resolves.toEqual({ read: 0, failed: 0 })

        expect(logger.error).toHaveBeenCalledWith(ZaloProviderLogEvent.ProfileRoundStopped, expect.any(Error), {})
    })
})
