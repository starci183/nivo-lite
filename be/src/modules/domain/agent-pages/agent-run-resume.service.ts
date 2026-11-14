import { Injectable } from "@nestjs/common"
import type { AgentRunResumeAnswer } from "./agent-run-resume.contracts"

/** The one answer: a thread run moves only through its stop. */
const THREAD_RUN: AgentRunResumeAnswer = { kind: "thread_run", stepKey: null }

@Injectable()
/** The old owner's resume of a parked run, kept as a shell: no run parks any more, so it reads nothing and answers `thread_run`. */
export class AgentRunResumeService {
    /** Answers `thread_run`: nothing is resumed. */
    resume(): Promise<AgentRunResumeAnswer> {
        return Promise.resolve(THREAD_RUN)
    }
}
