import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentGraphHoursGateService } from "./agent-graph-hours-gate.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

/** Every weekday 08:00-20:00 in Vietnam, not answering after hours. */
const HOURS = JSON.stringify({
    v: 1,
    afterHours: false,
    days: Array.from({ length: 7 }, () => [["08:00", "20:00"]]),
})

/** 21:00 in Vietnam on a Monday: off duty, 11 hours before the next opening. */
const NIGHT = "2026-11-09T14:00:00.000Z"

const TURN = agentTurnViewOf({
    source: "trigger",
    eventKey: "msg-7",
    context: { verb: "nivo.trigger.zalo.message.received", conversationId: "c-1", connectionId: "conn-1", messageId: "m-7" },
})

const build = async (settings: Readonly<Record<string, unknown>> | null, at = NIGHT, timeZone = "Asia/Ho_Chi_Minh") => {
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue(settings === null ? null : { settings }),
    })
    const wakes = mock<DeliveredWakesService>({ rewrite: jest.fn().mockResolvedValue("wake-later") })
    const logger = mock<Logger>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphHoursGateService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(at) },
            { provide: LOGGER, useValue: logger },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: DeliveredWakesService, useValue: wakes },
            { provide: WorkspaceTimeZoneService, useValue: { timeZoneOf: jest.fn().mockResolvedValue(timeZone) } },
        ],
    }).compile()
    return { gate: moduleRef.get(AgentGraphHoursGateService), wakes, logger }
}

describe("AgentGraphHoursGateService", () => {
    it("holds a customer who writes off duty for the next working hour, its drain waiting until then", async () => {
        const { gate, wakes, logger } = await build({ workingHours: HOURS })

        await expect(gate.deferred(TURN)).resolves.toBe(true)

        expect(wakes.rewrite).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "trigger",
            eventKey: "msg-7~open-1",
            context: TURN.context,
            actorMemberId: null,
            scopeKey: TURN.scopeKey,
            delayMs: 11 * 60 * 60_000,
        })
        expect(logger.info).toHaveBeenCalledWith(
            AgentGraphsLogEvent.HeldForHours,
            expect.objectContaining({ openAt: "2026-11-10T01:00:00.000Z" }),
        )
    })

    it("holds a wake that came due early again under the next count, so it is never lost", async () => {
        const { gate, wakes } = await build({ workingHours: HOURS })
        await gate.deferred({ ...TURN, eventKey: "msg-7~open-1" })
        expect(wakes.rewrite.mock.calls[0]?.[1].eventKey).toBe("msg-7~open-2")
    })

    it("lets the wake through on duty, when answering after hours, with no hours kept, or for a wake that is not a customer's", async () => {
        const onDuty = await build({ workingHours: HOURS }, "2026-11-09T03:00:00.000Z")
        await expect(onDuty.gate.deferred(TURN)).resolves.toBe(false)

        const always = await build({ workingHours: HOURS.replace('"afterHours":false', '"afterHours":true') })
        await expect(always.gate.deferred(TURN)).resolves.toBe(false)

        const none = await build({})
        await expect(none.gate.deferred(TURN)).resolves.toBe(false)
        const gone = await build(null)
        await expect(gone.gate.deferred(TURN)).resolves.toBe(false)

        const tag = await build({ workingHours: HOURS })
        await expect(tag.gate.deferred({ ...TURN, source: "tag", context: { conversationId: "c-1" } })).resolves.toBe(false)
        expect(tag.wakes.rewrite).not.toHaveBeenCalled()
    })

    it("reads the hours on the clock of the workspace's time zone", async () => {
        // 14:00Z on a Monday is 14:00 in London: on duty there (it is 21:00 in Vietnam, off duty).
        const london = await build({ workingHours: HOURS }, NIGHT, "Europe/London")
        await expect(london.gate.deferred(TURN)).resolves.toBe(false)
    })
})
