import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ModuleOpsErrorCode } from "./errors/module-ops.error"
import { LoggingOfficeLogService } from "./logging-office-log.service"
import { ModuleOpsLogEvent } from "./module-ops.log-events"
import { UnavailableApprovalGateService } from "./unavailable-approval-gate.service"
import { UnavailableOutboundMailService } from "./unavailable-outbound-mail.service"
import { UnavailableTextGeneratorService } from "./unavailable-text-generator.service"

describe("UnavailableApprovalGateService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnavailableApprovalGateService] }).compile()
        return moduleRef.get(UnavailableApprovalGateService)
    }

    it("refuses to ask for a decision", async () => {
        const gate = await build()

        await expect(gate.request()).rejects.toMatchObject({ code: ModuleOpsErrorCode.GateUnavailable })
    })

    it("refuses to record a decision", async () => {
        const gate = await build()

        await expect(gate.decide()).rejects.toMatchObject({ code: ModuleOpsErrorCode.GateUnavailable })
    })
})

describe("UnavailableTextGeneratorService", () => {
    it("answers that no text was written", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnavailableTextGeneratorService] }).compile()

        await expect(moduleRef.get(UnavailableTextGeneratorService).generate()).resolves.toEqual({
            ok: false,
            output: "",
        })
    })
})

describe("UnavailableOutboundMailService", () => {
    it("answers that the mail was not sent", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnavailableOutboundMailService] }).compile()

        await expect(moduleRef.get(UnavailableOutboundMailService).send()).resolves.toEqual({
            status: "failed",
            error: "unavailable",
        })
    })
})

describe("LoggingOfficeLogService", () => {
    const build = async () => {
        const events = mock<EventsService>()
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

        await office.postOffice("ws-1", "Stock is low")

        expect(logger.info).toHaveBeenCalledWith(ModuleOpsLogEvent.OfficeLineLogged, {
            workspaceId: "ws-1",
            body: "Stock is low",
        })
    })

    it("appends evidence to the workspace event log", async () => {
        const { office, events } = await build()

        await office.logEvidence("ws-1", {
            kind: "inventory.adjust",
            actor: "Lan",
            summary: "Flour 1 to 2",
            evidence: "counted",
        })

        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "inventory.adjust",
            actor: "Lan",
            summary: "Flour 1 to 2",
        })
    })

    it("logs a decision", async () => {
        const { office, logger } = await build()

        await office.logDecision("ws-1", {
            department: "inventory",
            action: "draft_purchase_order",
            decidedBy: "NIVO",
            deciderKind: "policy",
            outcome: "auto_done",
        })

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
