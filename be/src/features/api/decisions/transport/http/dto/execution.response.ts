/** An approval card after a decision. */
export class ExecutionResponse {
    /** The card id. */
    id!: string
    /** `pending_approval`, `approved` or `rejected`. */
    status!: string
    /** The work item behind it. */
    work_item_id!: string | null
    /** The draft as decided. */
    draft!: string
}
