import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_TIMEOUT } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { AgentProbesService } from "./agent-probes.service"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { InvoicesDueProbeService } from "./probes/invoices-due-probe.service"
import { MoneyInProbeService } from "./probes/money-in-probe.service"
import { NewDocumentsProbeService } from "./probes/new-documents-probe.service"
import { TasksDueProbeService } from "./probes/tasks-due-probe.service"
import type { ProbeAnswer } from "./agent-schedules.contracts"

const AGENT = { workspaceId: "ws-1", agentId: "agent-1" }

const FOUND: ProbeAnswer = { work: true, brief: "Invoices past due: INV-1.", subjectIds: ["inv-1"] }

const build = async (answer: Promise<ProbeAnswer> = Promise.resolve(FOUND)) => {
    const tasksDue = mock<TasksDueProbeService>({
        key: "tasks_due",
        check: jest.fn().mockResolvedValue({ work: false }),
    })
    const invoicesDue = mock<InvoicesDueProbeService>({
        key: "invoices_due",
        check: jest.fn().mockReturnValue(answer),
    })
    const cancel = jest.fn()
    const timeout = mock<QueueTimeout>({ schedule: jest.fn().mockReturnValue(cancel) })
    const logger = mock<Logger>()
    const container = await Test.createTestingModule({
        providers: [
            AgentProbesService,
            { provide: QUEUE_TIMEOUT, useValue: timeout },
            { provide: LOGGER, useValue: logger },
            { provide: TasksDueProbeService, useValue: tasksDue },
            { provide: InvoicesDueProbeService, useValue: invoicesDue },
            { provide: NewDocumentsProbeService, useValue: mock<NewDocumentsProbeService>({ key: "new_documents" }) },
            { provide: MoneyInProbeService, useValue: mock<MoneyInProbeService>({ key: "money_in" }) },
        ],
    }).compile()
    return { service: container.get(AgentProbesService), invoicesDue, tasksDue, timeout, cancel, logger }
}

describe("AgentProbesService.decide, the probes it knows", () => {
    it("brings tasks_due as well as the probes of invoices, documents and money", async () => {
        const { service, tasksDue } = await build()

        await expect(service.decide(AGENT, { probeKey: "tasks_due" })).resolves.toEqual({
            kind: "skip",
            reason: "no_work",
        })
        expect(tasksDue.check).toHaveBeenCalledWith(AGENT)
    })
})

describe("AgentProbesService.decide, what the probe found", () => {
    it("runs the wake with the brief of what its probe found", async () => {
        const { service, invoicesDue } = await build()

        await expect(service.decide(AGENT, { probeKey: "invoices_due" })).resolves.toEqual({
            kind: "run",
            brief: "Invoices past due: INV-1.",
            subjectIds: ["inv-1"],
        })
        expect(invoicesDue.check).toHaveBeenCalledWith(AGENT)
    })

    it("skips the wake as no work when the probe finds none", async () => {
        const { service } = await build(Promise.resolve({ work: false }))

        await expect(service.decide(AGENT, { probeKey: "invoices_due" })).resolves.toEqual({
            kind: "skip",
            reason: "no_work",
        })
    })

    it("needs no probe for a wake that carries a task", async () => {
        const { service, invoicesDue } = await build()

        await expect(service.decide(AGENT, { taskId: "task-1", probeKey: "invoices_due" })).resolves.toEqual({
            kind: "run",
            brief: null,
            subjectIds: ["task-1"],
        })
        expect(invoicesDue.check).not.toHaveBeenCalled()
    })

    it.each([{ triggerId: "trigger-1", slot: "1" }, { eventName: "bank_credit_booked" }])(
        "skips a clock or event wake that names no probe, since there is nothing to look at: no probe, no model",
        async (context) => {
            const { service } = await build()

            await expect(service.decide(AGENT, context)).resolves.toEqual({ kind: "skip", reason: "no_probe" })
        },
    )

    it("runs a wake that is neither a clock nor an event, and names no probe", async () => {
        const { service } = await build()

        await expect(service.decide(AGENT, {})).resolves.toEqual({ kind: "run", brief: null, subjectIds: [] })
    })
})

describe("AgentProbesService.decide, a probe that fails", () => {
    it("skips the wake as a failed probe when the probe throws, and says so", async () => {
        const { service, logger } = await build(Promise.reject(new Error("db down")))

        await expect(service.decide(AGENT, { probeKey: "invoices_due" })).resolves.toEqual({
            kind: "skip",
            reason: "probe_failed",
        })
        expect(logger.error).toHaveBeenCalledWith(AgentSchedulesLogEvent.ProbeFailed, expect.any(Error), {
            agentId: "agent-1",
            probeKey: "invoices_due",
        })
        expect(logger.warn).toHaveBeenCalledWith(AgentSchedulesLogEvent.ProbeSkipped, {
            agentId: "agent-1",
            probeKey: "invoices_due",
        })
    })

    it("skips the wake as a failed probe for a key nobody registered", async () => {
        const { service } = await build()

        await expect(service.decide(AGENT, { probeKey: "weather" })).resolves.toEqual({
            kind: "skip",
            reason: "probe_failed",
        })
    })

    it("gives a probe two seconds, then skips the wake", async () => {
        const { service, timeout } = await build(new Promise<ProbeAnswer>(() => undefined))
        timeout.schedule.mockImplementation((callback) => {
            callback()
            return jest.fn()
        })

        await expect(service.decide(AGENT, { probeKey: "invoices_due" })).resolves.toEqual({
            kind: "skip",
            reason: "probe_failed",
        })
        expect(timeout.schedule).toHaveBeenCalledWith(expect.any(Function), 2000)
    })

    it("cancels the deadline once the probe answered", async () => {
        const { service, cancel } = await build()

        await service.decide(AGENT, { probeKey: "invoices_due" })

        expect(cancel).toHaveBeenCalledTimes(1)
    })
})
