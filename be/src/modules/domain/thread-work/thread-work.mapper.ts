import type { ThreadWorkEntity } from "./persistence/entities"
import type { ThreadWorkRecord } from "./thread-work.contracts"

/** Maps a stored piece of thread work to the record the runtime moves. */
export const toThreadWorkRecord = (
    entity: Pick<
        ThreadWorkEntity,
        | "id"
        | "workspaceId"
        | "threadId"
        | "workItemId"
        | "agentId"
        | "state"
        | "approvalRequestId"
        | "waitingMemberId"
        | "missingFields"
    >,
): ThreadWorkRecord => ({
    id: entity.id,
    workspace_id: entity.workspaceId,
    thread_id: entity.threadId,
    work_item_id: entity.workItemId,
    agent_id: entity.agentId,
    state: entity.state,
    approval_request_id: entity.approvalRequestId,
    waiting_member_id: entity.waitingMemberId,
    missing_fields: entity.missingFields,
})
