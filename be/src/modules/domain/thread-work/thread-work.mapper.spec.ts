import { Test } from "@nestjs/testing"
import { workRow } from "@tests/fixtures/builders/thread-work-service.builder"
import { ThreadWorkEntity } from "./persistence/entities"
import type { ThreadWorkRecord } from "./thread-work.contracts"
import { toThreadWorkRecord as realToThreadWorkRecord } from "./thread-work.mapper"

const SUBJECT = Symbol("thread-work.mapper")
type Subject = { toThreadWorkRecord: typeof realToThreadWorkRecord }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toThreadWorkRecord: realToThreadWorkRecord } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The stored piece of work a record stands for. */
const threadWorkEntityOf = (record: ThreadWorkRecord): ThreadWorkEntity =>
    Object.assign(new ThreadWorkEntity(), {
        id: record.id,
        workspaceId: record.workspace_id,
        threadId: record.thread_id,
        workItemId: record.work_item_id,
        agentId: record.agent_id,
        state: record.state,
        approvalRequestId: record.approval_request_id,
        waitingMemberId: record.waiting_member_id,
        missingFields: record.missing_fields,
    })

describe("thread work mapper", () => {
    it("maps a stored piece of thread work to its record", async () => {
        const subject = await buildSubject()
        const record = workRow({
            id: "tw-1",
            thread_id: "thread-1",
            work_item_id: "item-1",
            agent_id: "agent-1",
            state: "asked",
            approval_request_id: "req-1",
            waiting_member_id: "member-minh",
            missing_fields: ["order_id"],
        })

        expect(subject.toThreadWorkRecord(threadWorkEntityOf(record))).toEqual(record)
    })
})
