import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { ToolGrantsLogEvent } from "./tool-grants.log-events"
import { NodeRightsSwitchService } from "./node-rights-switch.service"
import { toolGrantsEntities } from "./persistence/entities"

const NodeRightsSwitchEntity = toolGrantsEntities[4]
const WS = "ws-1"
const NOW = new Date("2026-11-12T03:00:00.000Z")

const build = async () => {
    const entityManager: MockEntityManager = mockEntityManager({ upsert: [NodeRightsSwitchEntity, {}] })
    const clock = new FakeClock(NOW)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeRightsSwitchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { switches: moduleRef.get(NodeRightsSwitchService), entityManager, clock, logger }
}

describe("NodeRightsSwitchService.decides", () => {
    it("is off for a workspace with no row and for a row that is off; on only for a row that is on", async () => {
        const { switches, entityManager } = await build()

        entityManager.findOne.mockResolvedValueOnce(null)
        expect(await switches.decides(WS)).toBe(false)
        entityManager.findOne.mockResolvedValueOnce({ decides: false })
        expect(await switches.decides(WS)).toBe(false)
        entityManager.findOne.mockResolvedValueOnce({ decides: true })
        expect(await switches.decides(WS)).toBe(true)

        expect(entityManager.findOne).toHaveBeenLastCalledWith(NodeRightsSwitchEntity, {
            select: { decides: true },
            where: { workspaceId: WS },
        })
    })

    it("reads the store on every call while it reads: a flip and its rollback bite on the next call", async () => {
        const { switches, entityManager } = await build()
        entityManager.findOne.mockResolvedValueOnce({ decides: true }).mockResolvedValueOnce({ decides: false })

        expect([await switches.decides(WS), await switches.decides(WS)]).toEqual([true, false])
        expect(entityManager.findOne).toHaveBeenCalledTimes(2)
    })

    it("never fails a call: an unreadable store (the table of an unapplied migration) is off, logged once, and asked again after the pause", async () => {
        const { switches, entityManager, clock, logger } = await build()
        const cause = new TypeError("relation node_rights_switches does not exist")
        entityManager.findOne.mockRejectedValue(cause)

        expect([await switches.decides(WS), await switches.decides(WS), await switches.decides("ws-2")]).toEqual([false, false, false])
        expect(entityManager.findOne).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(ToolGrantsLogEvent.NodeRightsSwitchUnreadable, cause, { workspaceId: WS })

        clock.advance(30_001)
        entityManager.findOne.mockResolvedValue({ decides: true })

        expect(await switches.decides(WS)).toBe(true)
    })
})

describe("NodeRightsSwitchService.flip and stateOf", () => {
    it("stores one row per workspace with what the flip read, and logs the flip", async () => {
        const { switches, entityManager, logger } = await build()
        const flip = { workspaceId: WS, decides: true, forced: true, compared: 40, differed: 2 }

        await switches.flip(flip)

        expect(entityManager.upsert).toHaveBeenCalledWith(
            NodeRightsSwitchEntity,
            { workspaceId: WS, decides: true, forced: true, compared: "40", differed: "2" },
            ["workspaceId"],
        )
        expect(logger.info).toHaveBeenCalledWith(ToolGrantsLogEvent.NodeRightsSwitchFlipped, flip)
    })

    it("answers off, never flipped, for a workspace with no row, and the stored state of one that has", async () => {
        const { switches, entityManager } = await build()

        entityManager.findOne.mockResolvedValueOnce(null)
        expect(await switches.stateOf(WS)).toEqual({ workspaceId: WS, decides: false, forced: false, compared: 0, differed: 0, flippedAt: null })

        entityManager.findOne.mockResolvedValueOnce({ decides: true, forced: false, compared: "12", differed: "0", updatedAt: NOW })
        expect(await switches.stateOf(WS)).toEqual({ workspaceId: WS, decides: true, forced: false, compared: 12, differed: 0, flippedAt: NOW })
    })
})
