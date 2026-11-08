import { builder, mock, type MockOf } from "@starci/jest-preset"
import type { AgentRunsService, AgentStepHandler, StepLink } from "@modules/domain/agent-runs"
import { runViewOf, stepSpecOf, stepViewOf } from "./agent-runs.builder"

type RunStore = ConstructorParameters<typeof AgentRunsService>[1]
type RunWait = Parameters<AgentRunsService["waitOn"]>[1]

/** The same deterministic successful store answers shared by the engine unit scenarios. */
export const arrangeRunStore = (store: MockOf<RunStore>): void => {
    store.runById.mockResolvedValue(runViewOf())
    store.runOfWake.mockResolvedValue(runViewOf())
    store.runIn.mockResolvedValue(runViewOf())
    store.append.mockResolvedValue(1)
    store.appendRows.mockResolvedValue(1)
    store.open.mockResolvedValue(runViewOf())
    store.resume.mockResolvedValue(true)
    store.stepsOf.mockResolvedValue([])
    store.viewsOf.mockResolvedValue([])
    store.waitingOn.mockResolvedValue(stepViewOf({ kind: "ask" }))
}

/** A transaction-owned wait whose workspace, wake and approval key remain exact. */
export const runWaitOf: (overrides?: Partial<RunWait>) => RunWait = builder<RunWait>({
    workspaceId: "ws-1",
    wakeId: "wake-1",
    workItemId: "item-1",
    deadlineAt: new Date("2026-11-04T00:00:00.000Z"),
    spec: stepSpecOf({ stepKey: "approval:item-1", kind: "approval" }),
})

const terminalLinkOf = builder<StepLink>({
    kind: "approval",
    agentId: "agent-1",
    status: "done",
    waitItemId: null,
    input: { workItemId: "item-1" },
})

/** A finished approval retains its immutable work-item link after the active wait was cleared. */
export const terminalLinksOf = (): ReadonlyArray<StepLink> => [terminalLinkOf()]

/** An approval handler that still needs another review never manufactures a completed decision. */
export const retryingDecisionHandlerOf = (): AgentStepHandler => {
    const handler = mock<Required<AgentStepHandler>>({ kind: "ask" })
    handler.onDecided.mockReturnValue({ kind: "retry", code: "awaiting_review" })
    return handler
}
