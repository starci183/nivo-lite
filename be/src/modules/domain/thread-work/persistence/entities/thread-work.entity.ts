import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { ThreadWorkState } from "../../thread-work.contracts"

@Entity({ schema: "public", name: "thread_work" })
/** One piece of work an agent does in a work thread, tied to the work item the engine runs; a work item is recorded once. */
export class ThreadWorkEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The thread. */
    @Column({ name: "thread_id", type: "uuid" })
    threadId!: string

    /** The work item, unique. */
    @Column({ name: "work_item_id", type: "uuid" })
    workItemId!: string

    /** The agent doing it. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** Where the work stands; constrained by a CHECK. */
    @Column({ name: "state", type: "text", default: () => "'running'" })
    state!: ThreadWorkState

    /** The approval request it waits for or once asked, or null. */
    @Column({ name: "approval_request_id", type: "uuid", nullable: true })
    approvalRequestId!: string | null

    /** The member it asked for data, or null. */
    @Column({ name: "waiting_member_id", type: "uuid", nullable: true })
    waitingMemberId!: string | null

    /** The fields it asked for. */
    @Column({ name: "missing_fields", type: "text", array: true, default: () => "'{}'::text[]" })
    missingFields!: Array<string>
}
