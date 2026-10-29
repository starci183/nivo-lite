import { toThreadWorkRecord } from "./thread-work.mapper"

describe("thread work mapper", () => {
    it("maps a stored piece of thread work to its record", () => {
        expect(
            toThreadWorkRecord({
                id: "tw-1",
                workspaceId: "ws-1",
                threadId: "thread-1",
                workItemId: "item-1",
                agentId: "agent-1",
                state: "waiting_approval",
                approvalRequestId: "req-1",
                waitingMemberId: "member-minh",
                missingFields: ["order_id"],
            } as never),
        ).toEqual({
            id: "tw-1",
            workspace_id: "ws-1",
            thread_id: "thread-1",
            work_item_id: "item-1",
            agent_id: "agent-1",
            state: "waiting_approval",
            approval_request_id: "req-1",
            waiting_member_id: "member-minh",
            missing_fields: ["order_id"],
        })
    })
})
