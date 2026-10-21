import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DecisionJobsService } from "@modules/domain/decisions"
import type {
    ConfirmCommandPayload,
    DecideExecutionPayload,
    DecideWorkPayload,
    DecisionsJobScope,
    ProposeCommandPayload,
    RunWorkPayload,
} from "@modules/queues/decisions"
import { DecisionsQueueService } from "./decisions-queue.service"
import { OfficeCommandService } from "./office-command.service"

const SCOPE: DecisionsJobScope = { workspaceId: "workspace-1", userId: "user-1", locale: "vi" }
const WORK: DecideWorkPayload = {
    ...SCOPE,
    workItemId: "work-1",
    decision: "approved",
    edits: { draft: "Updated draft", amount_vnd: 250000, fields: [{ name: "customer", text: "Lan" }] },
    note: "Checked",
    basis: "Receipt",
}
const EXECUTION: DecideExecutionPayload = {
    ...SCOPE,
    executionId: "execution-1",
    decision: "rejected",
    editedDraft: "Updated follow-up",
}
const PROPOSAL: ProposeCommandPayload = { ...SCOPE, messageId: "message-1" }
const CONFIRMATION: ConfirmCommandPayload = { ...SCOPE, locale: "en", candidateId: "candidate-1" }
const RUN: RunWorkPayload = { ...SCOPE, intent: "retry", workItemId: "work-1", requestId: "request-1" }
const RETIRED_SIMULATION = {
    ...SCOPE,
    kind: "simulate_inbound",
    inboundEventId: "event-1",
    items: "2 combos",
}

const build = async () => {
    const decisions = mock<DecisionJobsService>({
        decideWork: jest.fn().mockResolvedValue(undefined),
        decideExecution: jest.fn().mockResolvedValue(undefined),
    })
    const commands = mock<OfficeCommandService>({
        propose: jest.fn().mockResolvedValue({ kind: "chat" }),
        confirm: jest.fn().mockResolvedValue({ workItemId: "confirmed-work-1", module: "sales", created: true }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecisionsQueueService,
            { provide: DecisionJobsService, useValue: decisions },
            { provide: OfficeCommandService, useValue: commands },
        ],
    }).compile()
    return { service: moduleRef.get(DecisionsQueueService), decisions, commands }
}

describe("DecisionsQueueService", () => {
    it("runs a retry or handoff of a work item on the decision jobs service", async () => {
        const { service, decisions } = await build()
        decisions.runWork.mockResolvedValue(undefined)

        await service.handle(RUN)

        expect(decisions.runWork.mock.calls).toEqual([[RUN]])
        expect(decisions.decideWork.mock.calls).toEqual([])
    })

    it("ignores a queued job of the retired inbox simulator", async () => {
        const { service, decisions, commands } = await build()

        await expect(service.handle(RETIRED_SIMULATION)).resolves.toBeUndefined()

        expect(decisions.runWork.mock.calls).toEqual([])
        expect(decisions.decideWork.mock.calls).toEqual([])
        expect(decisions.decideExecution.mock.calls).toEqual([])
        expect(commands.propose.mock.calls).toEqual([])
        expect(commands.confirm.mock.calls).toEqual([])
    })

    it("passes the entire work decision to the decision jobs service", async () => {
        const { service, decisions, commands } = await build()

        await service.handle(WORK)

        expect(decisions.decideWork.mock.calls).toEqual([[WORK]])
        expect(decisions.decideExecution.mock.calls).toEqual([])
        expect(commands.propose.mock.calls).toEqual([])
        expect(commands.confirm.mock.calls).toEqual([])
    })

    it("passes the entire execution decision to the decision jobs service", async () => {
        const { service, decisions, commands } = await build()

        await service.handle(EXECUTION)

        expect(decisions.decideWork.mock.calls).toEqual([])
        expect(decisions.decideExecution.mock.calls).toEqual([[EXECUTION]])
        expect(commands.propose.mock.calls).toEqual([])
        expect(commands.confirm.mock.calls).toEqual([])
    })

    it("proposes the named message as the payload user in the payload workspace and locale", async () => {
        const { service, decisions, commands } = await build()

        await service.handle(PROPOSAL)

        expect(decisions.decideWork.mock.calls).toEqual([])
        expect(decisions.decideExecution.mock.calls).toEqual([])
        expect(commands.propose.mock.calls).toEqual([
            ["user-1", "workspace-1", { messageId: "message-1", locale: "vi" }],
        ])
        expect(commands.confirm.mock.calls).toEqual([])
    })

    it("confirms the named candidate as the payload user in the payload workspace and locale", async () => {
        const { service, decisions, commands } = await build()

        await service.handle(CONFIRMATION)

        expect(decisions.decideWork.mock.calls).toEqual([])
        expect(decisions.decideExecution.mock.calls).toEqual([])
        expect(commands.propose.mock.calls).toEqual([])
        expect(commands.confirm.mock.calls).toEqual([
            ["user-1", "workspace-1", { candidateId: "candidate-1", locale: "en" }],
        ])
    })
})
describe("DecisionsQueueService", () => {
    it("ignores a payload with another shape", async () => {
        const { service, decisions, commands } = await build()

        const payload = { ...SCOPE, installationId: "installation-1", force: true }

        await expect(service.handle(payload)).resolves.toBeUndefined()

        expect(decisions.decideWork.mock.calls).toEqual([])
        expect(decisions.decideExecution.mock.calls).toEqual([])
        expect(commands.propose.mock.calls).toEqual([])
        expect(commands.confirm.mock.calls).toEqual([])
    })

    it("routes a work decision before the other matching shapes", async () => {
        const { service, decisions, commands } = await build()
        const payload = { ...WORK, executionId: "execution-1", messageId: "message-1", candidateId: "candidate-1" }

        await service.handle(payload)

        expect(decisions.decideWork.mock.calls).toEqual([[payload]])
        expect(decisions.decideExecution.mock.calls).toEqual([])
        expect(commands.propose.mock.calls).toEqual([])
        expect(commands.confirm.mock.calls).toEqual([])
    })

    it("routes an execution decision before matching command shapes", async () => {
        const { service, decisions, commands } = await build()
        const payload = { ...EXECUTION, messageId: "message-1", candidateId: "candidate-1" }

        await service.handle(payload)

        expect(decisions.decideWork.mock.calls).toEqual([])
        expect(decisions.decideExecution.mock.calls).toEqual([[payload]])
        expect(commands.propose.mock.calls).toEqual([])
        expect(commands.confirm.mock.calls).toEqual([])
    })

    it("routes a proposal before a matching confirmation shape", async () => {
        const { service, decisions, commands } = await build()

        await service.handle({ ...PROPOSAL, candidateId: "candidate-1" })

        expect(decisions.decideWork.mock.calls).toEqual([])
        expect(decisions.decideExecution.mock.calls).toEqual([])
        expect(commands.propose.mock.calls).toEqual([
            ["user-1", "workspace-1", { messageId: "message-1", locale: "vi" }],
        ])
        expect(commands.confirm.mock.calls).toEqual([])
    })
})
