import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoggingOfficeLogService } from "./logging-office-log.service"
import { ModuleOpsLogEvent } from "./module-ops.log-events"

describe("LoggingOfficeLogService", () => {
    const build = async () => {
        const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                LoggingOfficeLogService,
                { provide: EventsService, useValue: events },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()
        return { office: moduleRef.get(LoggingOfficeLogService), events, logger }
    }

    it("logs an Office line", async () => {
        const { office, logger } = await build()

        await expect(office.postOffice("ws-1", "Stock is low")).resolves.toBeUndefined()

        expect(logger.info).toHaveBeenCalledWith(ModuleOpsLogEvent.OfficeLineLogged, {
            workspaceId: "ws-1",
            body: "Stock is low",
        })
    })

    it("appends evidence to the workspace event log", async () => {
        const { office, events } = await build()

        await expect(
            office.logEvidence("ws-1", {
                kind: "inventory.adjust",
                actor: "Lan",
                summary: "Flour 1 to 2",
                evidence: "counted",
            }),
        ).resolves.toBeUndefined()

        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "inventory.adjust",
            actor: "Lan",
            summary: "Flour 1 to 2",
        })
    })

    it("logs a decision", async () => {
        const { office, logger } = await build()

        await expect(
            office.logDecision("ws-1", {
                department: "inventory",
                action: "draft_purchase_order",
                decidedBy: "NIVO",
                deciderKind: "policy",
                outcome: "auto_done",
            }),
        ).resolves.toBeUndefined()

        expect(logger.info).toHaveBeenCalledWith(ModuleOpsLogEvent.DecisionLogged, {
            workspaceId: "ws-1",
            action: "draft_purchase_order",
            outcome: "auto_done",
        })
    })

    it("names every workspace after the product", async () => {
        const { office } = await build()

        await expect(office.workspaceName()).resolves.toBe("NIVO")
    })
})
