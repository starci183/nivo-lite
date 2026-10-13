/** What confirming a command card did. */
export class ConfirmResultResponse {
    /** The work item the command became. */
    workItemId!: string
    /** The receiving module. */
    module!: string
    /** False when the same work already existed. */
    created!: boolean
}
