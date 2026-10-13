/** One line of the Office thread. */
export class MessageResponse {
    /** The message id. */
    id!: string
    /** `human`, `agent` or `system`. */
    author_kind!: string
    /** The name shown as author. */
    author_name!: string
    /** The agent that spoke, when one did. */
    agent_id!: string | null
    /** The staff member that wrote, when one did. */
    staff_id!: string | null
    /** The text. */
    body!: string
    /** The customer it is about. */
    lead_id!: string | null
    /** The work item it mirrors. */
    work_item_id!: string | null
    /** The customer's name, when the line names one. */
    lead_name!: string | null
    /** The department of the work item the line mirrors. */
    department!: string | null
    /** When it was posted. */
    created_at!: string
}

/** The position to pass as `before` for the next older page. */
export class ThreadCursorResponse {
    /** The `created_at` of the oldest message of this page. */
    createdAt!: string
    /** The id of the oldest message of this page. */
    id!: string
}

/** One page of the Office thread, newest first. */
export class MessagePageResponse {
    /** The messages of the page. */
    messages!: ReadonlyArray<MessageResponse>
    /** The cursor of the next page; null at the end. */
    next!: ThreadCursorResponse | null
}
