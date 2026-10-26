import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { ChatTypingService } from "./chat-typing.service"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "workspace-1",
    role: "owner",
    staffId: null,
    displayName: "Mai Linh",
    status: "active",
})

const OFFICE = { room: null, conversationId: null }
const NOW = "2026-10-25T03:00:00.000Z"

const build = async () => {
    const markers = mock<ChatMarkersService>({
        requireTarget: jest.fn().mockResolvedValue(memberOf()),
        memberIds: jest.fn().mockResolvedValue(["user-1", "user-2", "user-3"]),
    })
    const realtime = mock<RealtimeHub>({ publish: jest.fn().mockResolvedValue(undefined) })
    const clock = new FakeClock(NOW)
    const now = jest.spyOn(clock, "now")
    const container = await Test.createTestingModule({
        providers: [
            ChatTypingService,
            { provide: ChatMarkersService, useValue: markers },
            { provide: REALTIME_HUB, useValue: realtime },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: container.get(ChatTypingService), markers, realtime, now }
}

describe("ChatTypingService.channel", () => {
    it("describes the general Office's private channel only after target authorization", async () => {
        const { service, markers, realtime } = await build()

        await expect(service.channel("principal", "WORKSPACE-1", OFFICE)).resolves.toEqual({
            topic: "chat-typing:workspace-1:room:office",
            event: "typing",
            private: true,
            ttlMs: 5000,
        })
        expect(markers.requireTarget).toHaveBeenCalledWith("principal", "WORKSPACE-1", OFFICE)
        expect(realtime.publish).not.toHaveBeenCalled()
    })

    it("uses distinct department and conversation topics and canonicalizes UUID case", async () => {
        const { service } = await build()

        await expect(
            service.channel("principal", "workspace-1", { room: "sales", conversationId: null }),
        ).resolves.toEqual({
            topic: "chat-typing:workspace-1:room:sales",
            event: "typing",
            private: true,
            ttlMs: 5000,
        })
        await expect(
            service.channel("principal", "WORKSPACE-1", { room: null, conversationId: "CONVERSATION-1" }),
        ).resolves.toEqual({
            topic: "chat-typing:workspace-1:conversation:conversation-1",
            event: "typing",
            private: true,
            ttlMs: 5000,
        })
    })

    it("propagates target refusal without opening or publishing a channel", async () => {
        const { service, markers, realtime } = await build()
        const refusal = new Error("target not admitted")
        markers.requireTarget.mockRejectedValue(refusal)

        await expect(service.channel("principal", "workspace-1", OFFICE)).rejects.toBe(refusal)
        expect(realtime.publish).not.toHaveBeenCalled()
    })
})

describe("ChatTypingService.set", () => {
    it("authors the admitted account identity and gives a start signal a five-second deadline", async () => {
        const { service, markers, realtime } = await build()
        const signal = {
            id: "user-1",
            name: "Mai Linh",
            avatarSeed: "user-1",
            typing: true,
            expiresAt: "2026-10-25T03:00:05.000Z",
        }

        await expect(service.set("principal", "workspace-1", OFFICE, true)).resolves.toEqual(signal)
        expect(markers.requireTarget).toHaveBeenCalledWith("principal", "workspace-1", OFFICE)
        const frame = { id: `user-1:${NOW}`, actorId: "user-1", actorName: "Mai Linh", state: "start", at: NOW }
        expect(markers.memberIds).toHaveBeenCalledWith("principal", "workspace-1", OFFICE)
        expect(realtime.publish).toHaveBeenCalledTimes(2)
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-2:workspace-1:room:office" }),
            frame,
        )
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-3:workspace-1:room:office" }),
            frame,
        )
    })

    it("expires a stop signal immediately and targets only its conversation", async () => {
        const { service, realtime } = await build()
        const signal = {
            id: "user-1",
            name: "Mai Linh",
            avatarSeed: "user-1",
            typing: false,
            expiresAt: NOW,
        }

        await expect(
            service.set("principal", "workspace-1", { room: null, conversationId: "c-1" }, false),
        ).resolves.toEqual(signal)
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-2:workspace-1:conversation:c-1" }),
            { id: `user-1:${NOW}`, actorId: "user-1", actorName: "Mai Linh", state: "stop", at: NOW },
        )
    })

    it("does not publish when membership or target validation fails", async () => {
        const { service, markers, realtime, now } = await build()
        const refusal = new Error("target not admitted")
        markers.requireTarget.mockRejectedValue(refusal)

        await expect(service.set("principal", "workspace-1", OFFICE, true)).rejects.toBe(refusal)
        expect(realtime.publish).not.toHaveBeenCalled()
        expect(now).not.toHaveBeenCalled()
    })

    it("propagates a failed publish instead of acknowledging an unsent signal", async () => {
        const { service, realtime } = await build()
        const failure = new Error("realtime unavailable")
        realtime.publish.mockRejectedValue(failure)

        await expect(service.set("principal", "workspace-1", OFFICE, true)).rejects.toBe(failure)
    })
})
