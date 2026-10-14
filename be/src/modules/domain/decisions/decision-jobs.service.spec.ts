import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ExecutionRow } from "@modules/domain/executions"
import type { DecideExecutionPayload, DecideWorkPayload, RunWorkPayload } from "@modules/queues/decisions"
import { DecisionJobsService } from "./decision-jobs.service"
import type { WorkItem } from "./decisions.contracts"
import { WorkDecisionService } from "./work-decision.service"

const build = async () => {
    const decisions = mock<WorkDecisionService>()
    decisions.decide.mockResolvedValue(mock<WorkItem>())
    decisions.decideExecution.mockResolvedValue(mock<ExecutionRow>())
    const moduleRef = await Test.createTestingModule({
        providers: [DecisionJobsService, { provide: WorkDecisionService, useValue: decisions }],
    }).compile()
    return { service: moduleRef.get(DecisionJobsService), decisions }
}

describe("DecisionJobsService", () => {
    it("decides work as the queued user with every edit, note, basis and locale", async () => {
        const { service, decisions } = await build()
        const payload: DecideWorkPayload = {
            userId: "user-1",
            workspaceId: "workspace-1",
            workItemId: "work-1",
            decision: "approved",
            locale: "vi",
            edits: {
                draft: "Updated draft",
                amount_vnd: null,
                candidateId: "invoice-1",
                fields: [
                    { name: "recipient", text: "An" },
                    { name: "amount", number: 150_000 },
                ],
            },
            note: "Ready to send",
            basis: "Verified payment",
        }

        await expect(service.decideWork(payload)).resolves.toBeUndefined()

        expect(decisions.decide).toHaveBeenCalledTimes(1)
        expect(decisions.decide).toHaveBeenCalledWith("user-1", "workspace-1", {
            workItemId: "work-1",
            decision: "approved",
            edits: payload.edits,
            note: "Ready to send",
            basis: "Verified payment",
            locale: "vi",
        })
        expect(decisions.decideExecution).not.toHaveBeenCalled()
    })

    it("converts null edits to undefined while preserving null optional texts", async () => {
        const { service, decisions } = await build()
        const payload: DecideWorkPayload = {
            userId: "user-2",
            workspaceId: "workspace-2",
            workItemId: "work-2",
            decision: "rejected",
            locale: "en",
            edits: null,
            note: null,
            basis: null,
        }

        await service.decideWork(payload)

        expect(decisions.decide).toHaveBeenCalledTimes(1)
        expect(decisions.decide).toHaveBeenCalledWith("user-2", "workspace-2", {
            workItemId: "work-2",
            decision: "rejected",
            edits: undefined,
            note: null,
            basis: null,
            locale: "en",
        })
    })

    it("passes omitted work edits and optional texts as undefined", async () => {
        const { service, decisions } = await build()
        const payload: DecideWorkPayload = {
            userId: "user-3",
            workspaceId: "workspace-3",
            workItemId: "work-3",
            decision: "approved",
            locale: "en",
        }

        await service.decideWork(payload)

        expect(decisions.decide).toHaveBeenCalledTimes(1)
        expect(decisions.decide).toHaveBeenCalledWith("user-3", "workspace-3", {
            workItemId: "work-3",
            decision: "approved",
            edits: undefined,
            note: undefined,
            basis: undefined,
            locale: "en",
        })
    })

    it.each(["Edited draft", null, undefined])("decides an execution with editedDraft %p", async (editedDraft) => {
        const { service, decisions } = await build()
        const payload: DecideExecutionPayload = {
            userId: "user-4",
            workspaceId: "workspace-4",
            executionId: "execution-4",
            decision: "rejected",
            editedDraft,
            locale: "vi",
        }

        await expect(service.decideExecution(payload)).resolves.toBeUndefined()

        expect(decisions.decideExecution).toHaveBeenCalledTimes(1)
        expect(decisions.decideExecution).toHaveBeenCalledWith("user-4", "workspace-4", {
            executionId: "execution-4",
            decision: "rejected",
            editedDraft,
            locale: "vi",
        })
        expect(decisions.decide).not.toHaveBeenCalled()
    })

    it("propagates a refused work decision", async () => {
        const { service, decisions } = await build()
        const refusal = new Error("Work item is no longer waiting")
        decisions.decide.mockRejectedValue(refusal)
        const payload: DecideWorkPayload = {
            userId: "user-1",
            workspaceId: "workspace-1",
            workItemId: "work-1",
            decision: "approved",
            locale: "en",
        }

        await expect(service.decideWork(payload)).rejects.toBe(refusal)

        expect(decisions.decideExecution).not.toHaveBeenCalled()
    })

    it("propagates a refused execution decision", async () => {
        const { service, decisions } = await build()
        const refusal = new Error("Approval card is no longer waiting")
        decisions.decideExecution.mockRejectedValue(refusal)
        const payload: DecideExecutionPayload = {
            userId: "user-1",
            workspaceId: "workspace-1",
            executionId: "execution-1",
            decision: "approved",
            locale: "en",
        }

        await expect(service.decideExecution(payload)).rejects.toBe(refusal)

        expect(decisions.decide).not.toHaveBeenCalled()
    })

    it("runs queued work for the user, workspace, item, locale and intent", async () => {
        const { service, decisions } = await build()
        const payload: RunWorkPayload = {
            userId: "user-1",
            workspaceId: "workspace-1",
            workItemId: "work-1",
            locale: "vi",
            intent: "retry",
            requestId: "request-1",
        }

        await expect(service.runWork(payload)).resolves.toBeUndefined()

        expect(decisions.runQueued).toHaveBeenCalledTimes(1)
        expect(decisions.runQueued).toHaveBeenCalledWith("user-1", "workspace-1", "work-1", "vi", "retry")
    })
})
