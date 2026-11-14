import type { SandboxWaitingRunsQuery } from "@/modules/api"
import type { SandboxWaitingRowView } from "@/modules/types"
import { SANDBOX_JOIN, type SandboxWords } from "./sandbox.words"

/** The runs parked at a wait: who they work for, what they wait for and when the wait ends (the card counts the time down). */
export const waitingRowsOf = (
    runs: SandboxWaitingRunsQuery["sandboxWaitingRuns"],
    words: SandboxWords,
): ReadonlyArray<SandboxWaitingRowView> =>
    runs.map((run) => ({
        runId: run.runId,
        title: [run.agentLabel, run.personLabel].filter((part) => part !== "").join(SANDBOX_JOIN),
        what: run.waitsFor.length === 0 ? words.waitingWhatAny : words.waitingWhat(run.waitsFor.join(", ")),
        dueAt: run.dueAt,
    }))
