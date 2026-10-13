import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { HealthCandidate } from "@modules/domain/connections"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ConnectionHealthService } from "./connection-health.service"

const NOW = "2026-10-12T10:00:00.000Z"

const connection = (patch: Partial<HealthCandidate> = {}): HealthCandidate => ({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "telegram",
    name: "Bot",
    status: "connected",
    lastError: "",
    lastEventAt: "2026-10-12T09:00:00.000Z",
    createdAt: "2026-10-01T09:00:00.000Z",
    health: "",
    ...patch,
})

const build = async () => {
    const clock = new FakeClock(NOW)
    const logger = mock<Logger>()
    const connections = mock<ConnectionsService>()
    connections.healthBatch.mockResolvedValue([])
    connections.markHealth.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionHealthService,
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionHealthService), clock, logger, connections }
}

describe("ConnectionHealthService", () => {
    describe("checkFromJob", () => {
        it("uses the payload silence horizon for the queued check", async () => {
            const { service, connections, logger } = await build()
            connections.healthBatch.mockResolvedValue([connection({ lastEventAt: "2026-10-12T07:00:00.000Z" })])

            await expect(service.checkFromJob({ silentAfterHours: 2 })).resolves.toEqual({
                checked: 1,
                ok: 0,
                silent: 1,
                failing: 0,
                changed: 1,
            })

            expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
            expect(connections.markHealth.mock.calls).toEqual([
                ["c-1", { state: "silent", reason: "no event for 3h", checkedAt: NOW }],
            ])
            expect(logger.warn.mock.calls).toEqual([
                [
                    "channels.connection.unhealthy",
                    { workspaceId: "ws-1", connectionId: "c-1", provider: "telegram", state: "silent" },
                ],
            ])
        })

        it.each([undefined, null, "tick", [], {}, { silentAfterHours: "2" }])(
            "uses the default 72-hour horizon for another payload: %p",
            async (payload) => {
                const { service, connections, logger } = await build()
                connections.healthBatch.mockResolvedValue([
                    connection({ id: "c-recent", lastEventAt: "2026-10-09T10:00:00.000Z" }),
                    connection({ id: "c-old", lastEventAt: "2026-10-09T09:00:00.000Z" }),
                ])

                await expect(service.checkFromJob(payload)).resolves.toEqual({
                    checked: 2,
                    ok: 1,
                    silent: 1,
                    failing: 0,
                    changed: 1,
                })

                expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
                expect(connections.markHealth.mock.calls).toEqual([
                    ["c-old", { state: "silent", reason: "no event for 73h", checkedAt: NOW }],
                ])
                expect(logger.warn.mock.calls).toEqual([
                    [
                        "channels.connection.unhealthy",
                        { workspaceId: "ws-1", connectionId: "c-old", provider: "telegram", state: "silent" },
                    ],
                ])
            },
        )
    })

    it("answers an empty tally when the first page has no connections", async () => {
        const { service, connections, logger } = await build()

        await expect(service.checkAll()).resolves.toEqual({ checked: 0, ok: 0, silent: 0, failing: 0, changed: 0 })

        expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
        expect(connections.markHealth).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("skips setup that is still pending, even when its event is old and its recorded health is failing", async () => {
        const { service, connections, logger } = await build()
        connections.healthBatch.mockResolvedValue([
            connection({ status: "pending", health: "failing", lastEventAt: "" }),
        ])

        await expect(service.checkAll()).resolves.toEqual({ checked: 0, ok: 0, silent: 0, failing: 0, changed: 0 })

        expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
        expect(connections.markHealth).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("counts unchanged verdicts, treating an unmarked healthy connection as already healthy", async () => {
        const { service, connections, logger } = await build()
        connections.healthBatch.mockResolvedValue([
            connection({ id: "c-1", health: "ok" }),
            connection({ id: "c-2" }),
            connection({ id: "c-3", health: "silent", lastEventAt: "2026-10-09T09:00:00.000Z" }),
            connection({ id: "c-4", health: "failing", status: "error", lastError: "Reconnect" }),
        ])

        await expect(service.checkAll()).resolves.toEqual({ checked: 4, ok: 2, silent: 1, failing: 1, changed: 0 })

        expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
        expect(connections.markHealth).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("records each changed verdict at the injected time and warns only for unhealthy changes", async () => {
        const { service, connections, logger } = await build()
        connections.healthBatch.mockResolvedValue([
            connection({ id: "c-ok", health: "silent" }),
            connection({ id: "c-silent", provider: "zalo_oa", lastEventAt: "2026-10-09T09:00:00.000Z" }),
            connection({ id: "c-failing", workspaceId: "ws-2", status: "error", lastError: "Reconnect", health: "ok" }),
        ])

        await expect(service.checkAll()).resolves.toEqual({ checked: 3, ok: 1, silent: 1, failing: 1, changed: 3 })

        expect(connections.markHealth.mock.calls).toEqual([
            ["c-ok", { state: "ok", reason: "", checkedAt: NOW }],
            ["c-silent", { state: "silent", reason: "no event for 73h", checkedAt: NOW }],
            ["c-failing", { state: "failing", reason: "Reconnect", checkedAt: NOW }],
        ])
        expect(logger.warn.mock.calls).toEqual([
            [
                "channels.connection.unhealthy",
                { workspaceId: "ws-1", connectionId: "c-silent", provider: "zalo_oa", state: "silent" },
            ],
            [
                "channels.connection.unhealthy",
                { workspaceId: "ws-2", connectionId: "c-failing", provider: "telegram", state: "failing" },
            ],
        ])
        expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
    })

    it("uses the supplied silence threshold and the current clock on every check", async () => {
        const { service, connections, clock, logger } = await build()
        connections.healthBatch.mockResolvedValue([connection()])

        await expect(service.checkAll(1)).resolves.toEqual({ checked: 1, ok: 1, silent: 0, failing: 0, changed: 0 })
        clock.advance(3_600_000)
        await expect(service.checkAll(1)).resolves.toEqual({ checked: 1, ok: 0, silent: 1, failing: 0, changed: 1 })

        expect(connections.markHealth.mock.calls).toEqual([
            ["c-1", { state: "silent", reason: "no event for 2h", checkedAt: "2026-10-12T11:00:00.000Z" }],
        ])
        expect(logger.warn.mock.calls).toEqual([
            [
                "channels.connection.unhealthy",
                { workspaceId: "ws-1", connectionId: "c-1", provider: "telegram", state: "silent" },
            ],
        ])
    })

    it("continues a full page after its last id, preserving the threshold and the tally on the final short page", async () => {
        const { service, connections, logger } = await build()
        const firstPage = Array.from({ length: 200 }, (_, index) => connection({ id: `c-${index + 1}` }))
        connections.healthBatch.mockResolvedValueOnce(firstPage)
        connections.healthBatch.mockResolvedValueOnce([
            connection({ id: "c-201", lastEventAt: "2026-10-12T07:00:00.000Z" }),
        ])

        await expect(service.checkAll(2)).resolves.toEqual({ checked: 201, ok: 200, silent: 1, failing: 0, changed: 1 })

        expect(connections.healthBatch.mock.calls).toEqual([
            ["", 200],
            ["c-200", 200],
        ])
        expect(connections.markHealth.mock.calls).toEqual([
            ["c-201", { state: "silent", reason: "no event for 3h", checkedAt: NOW }],
        ])
        expect(logger.warn.mock.calls).toEqual([
            [
                "channels.connection.unhealthy",
                { workspaceId: "ws-1", connectionId: "c-201", provider: "telegram", state: "silent" },
            ],
        ])
    })

    it("stops at an empty page after a full page", async () => {
        const { service, connections } = await build()
        connections.healthBatch.mockResolvedValueOnce(
            Array.from({ length: 200 }, (_, index) => connection({ id: `c-${index + 1}` })),
        )

        await expect(service.checkAll()).resolves.toEqual({ checked: 200, ok: 200, silent: 0, failing: 0, changed: 0 })

        expect(connections.healthBatch.mock.calls).toEqual([
            ["", 200],
            ["c-200", 200],
        ])
        expect(connections.markHealth).not.toHaveBeenCalled()
    })

    it("finishes a changed verdict before judging the next connection", async () => {
        const { service, connections, logger } = await build()
        connections.healthBatch.mockResolvedValue([
            connection({ id: "c-1", status: "error", lastError: "Reconnect" }),
            connection({ id: "c-2", health: "silent" }),
        ])
        let finishMark = () => {}
        const pendingMark = new Promise<void>((resolve) => {
            finishMark = resolve
        })
        let startMark = () => {}
        const markStarted = new Promise<void>((resolve) => {
            startMark = resolve
        })
        connections.markHealth.mockImplementationOnce(() => {
            startMark()
            return pendingMark
        })

        const checking = service.checkAll()
        await markStarted

        expect(connections.markHealth.mock.calls).toEqual([
            ["c-1", { state: "failing", reason: "Reconnect", checkedAt: NOW }],
        ])
        expect(logger.warn).not.toHaveBeenCalled()
        finishMark()
        await expect(checking).resolves.toEqual({ checked: 2, ok: 1, silent: 0, failing: 1, changed: 2 })
        expect(connections.markHealth.mock.calls).toEqual([
            ["c-1", { state: "failing", reason: "Reconnect", checkedAt: NOW }],
            ["c-2", { state: "ok", reason: "", checkedAt: NOW }],
        ])
        expect(logger.warn.mock.calls).toEqual([
            [
                "channels.connection.unhealthy",
                { workspaceId: "ws-1", connectionId: "c-1", provider: "telegram", state: "failing" },
            ],
        ])
    })

    it("propagates a failed page read before recording any verdict", async () => {
        const { service, connections, logger } = await build()
        const failure = new Error("health page unavailable")
        connections.healthBatch.mockRejectedValue(failure)

        await expect(service.checkAll()).rejects.toBe(failure)

        expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
        expect(connections.markHealth).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("propagates a failed mark without warning or processing the next connection", async () => {
        const { service, connections, logger } = await build()
        const failure = new Error("health write unavailable")
        connections.healthBatch.mockResolvedValue([
            connection({ id: "c-1", status: "error", lastError: "Reconnect" }),
            connection({ id: "c-2", status: "error", lastError: "Reauthorize" }),
        ])
        connections.markHealth.mockRejectedValue(failure)

        await expect(service.checkAll()).rejects.toBe(failure)

        expect(connections.markHealth.mock.calls).toEqual([
            ["c-1", { state: "failing", reason: "Reconnect", checkedAt: NOW }],
        ])
        expect(connections.healthBatch.mock.calls).toEqual([["", 200]])
        expect(logger.warn).not.toHaveBeenCalled()
    })
})
