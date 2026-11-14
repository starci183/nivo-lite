import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { ThreadResumeRequestsService } from "../thread-resume-requests.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { RunStop } from "./run-stop.contracts"
import { StopHandBackService } from "./stop-hand-back.service"

const NOW = "2026-11-14T09:30:00.000Z"
const TAKEN = { kind: "take_over" as const, text: null, by: "member-1", at: "2026-11-14T09:00:00.000Z" }

const stopOf = (over: Partial<RunStop>): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "understand",
    agentId: "agent-front",
    workflowId: "wf-front",
    contactId: "contact-1",
    conversationId: "route-1",
    kind: "ai_report",
    state: "open",
    reason: "the thread read was refused",
    question: null,
    detail: { suggestions: [], facts: [] },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [TAKEN],
    decision: TAKEN,
    repeats: 1,
    stoppedAt: "2026-11-14T08:59:00.000Z",
    resolvedAt: null,
    ...over,
})

const build = (ofPerson: ReadonlyArray<RunStop>, ofWorkspace: ReadonlyArray<RunStop>) => {
    const records = mock<RunStopRecordsService>({
        ofContacts: jest.fn().mockResolvedValue(ofPerson),
        newest: jest.fn().mockResolvedValue(ofWorkspace),
    })
    const threads = mock<ThreadResumeRequestsService>({ resume: jest.fn().mockResolvedValue({ kind: "admitted", fresh: true }) })
    return { service: new StopHandBackService(new FakeClock(new Date(NOW)), mock<Logger>(), records, threads), records, threads }
}

describe("StopHandBackService (R51 item 3: a hand-back ends the take-overs left on the route)", () => {
    it("ends each open stop taken over on the route ONCE, as the member who hands back, through the resume door in the caller's transaction", async () => {
        const taken = stopOf({})
        const { service, threads } = build([taken], [taken])
        const tx = mockEntityManager()

        await expect(service.handedBack(tx, "ws-1", "route-1", "contact-1", "member-2")).resolves.toBe(1)

        expect(threads.resume).toHaveBeenCalledTimes(1)
        expect(threads.resume).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "run-1", stepKey: "understand" }, { kind: "skip", by: "member-2", at: NOW }, tx)
    })

    it("leaves every other stop: another route's, one never taken over, one answered after the take-over, one already resolved", async () => {
        const { service, threads } = build(
            [stopOf({ id: "s-other-route", conversationId: "route-2" }), stopOf({ id: "s-fresh", decision: null, answers: [] })],
            [
                stopOf({ id: "s-retried", decision: { kind: "retry", text: null, by: "member-1", at: NOW } }),
                stopOf({ id: "s-closed", state: "resolved", resolvedAt: NOW }),
            ],
        )

        await expect(service.handedBack(mockEntityManager(), "ws-1", "route-1", "contact-1", "member-2")).resolves.toBe(0)
        expect(threads.resume).not.toHaveBeenCalled()
    })

    it("finds the stop by the workspace's open stops when the route names no person, and counts only admitted decisions", async () => {
        const { service, threads, records } = build([], [stopOf({})])
        threads.resume.mockResolvedValue({ kind: "refused", code: "thread_not_stopped" })

        await expect(service.handedBack(mockEntityManager(), "ws-1", "route-1", null, "member-2")).resolves.toBe(0)
        expect(records.ofContacts).not.toHaveBeenCalled()
        expect(threads.resume).toHaveBeenCalledTimes(1)
    })
})
