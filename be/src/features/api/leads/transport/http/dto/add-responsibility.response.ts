/** The HTTP response of add-responsibility. */
export class AddResponsibilityResponse {
    /** The responsibility id. */
    id!: string
    /** The lead it belongs to. */
    leadId!: string
    /** The title of the step. */
    title!: string
    /** `human` or `agent`. */
    ownerKind!: string
    /** The agent that owns it, when it is an agent. */
    ownerAgentId!: string | null
    /** The name shown as owner. */
    ownerName!: string
    /** What happens next. */
    nextAction!: string
    /** When it is due, ISO 8601. */
    dueAt!: string | null
    /** `open`, `waiting_approval` or `done`. */
    status!: string
}
