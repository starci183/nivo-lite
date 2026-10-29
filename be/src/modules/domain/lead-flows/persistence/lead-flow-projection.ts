import { LeadFlowEntity } from "./entities"

/** The entity property and the column it reads, for every column a `RETURNING *` row carries. */
const COLUMNS: ReadonlyArray<readonly [string, string]> = [
    ["id", "id"],
    ["workspaceId", "workspace_id"],
    ["leadId", "lead_id"],
    ["connectionId", "connection_id"],
    ["conversationId", "conversation_id"],
    ["platform", "platform"],
    ["psid", "psid"],
    ["igsid", "igsid"],
    ["phone", "phone"],
    ["email", "email"],
    ["name", "name"],
    ["state", "state"],
    ["resumeState", "resume_state"],
    ["source", "source"],
    ["touches", "touches"],
    ["answers", "answers"],
    ["asked", "asked"],
    ["pendingQuestion", "pending_question"],
    ["contactAskedAt", "contact_asked_at"],
    ["signals", "signals"],
    ["score", "score"],
    ["scoreReasons", "score_reasons"],
    ["scoredAt", "scored_at"],
    ["analysis", "analysis"],
    ["lastUserAt", "last_user_at"],
    ["lastUserText", "last_user_text"],
    ["greetedAt", "greeted_at"],
    ["handedOffAt", "handed_off_at"],
    ["followedUpAt", "followed_up_at"],
    ["closedAt", "closed_at"],
    ["escalatedAt", "escalated_at"],
    ["escalationReason", "escalation_reason"],
    ["createdAt", "created_at"],
    ["updatedAt", "updated_at"],
    ["installationId", "installation_id"],
]

/** The first flow a `RETURNING *` write answered, read as an entity; undefined when the write answered nothing. */
export const leadFlowOfRaw = (raw: unknown): LeadFlowEntity | undefined => {
    const [row] = Array.isArray(raw) ? raw : []
    if (typeof row !== "object" || row === null) return undefined
    return Object.assign(
        new LeadFlowEntity(),
        Object.fromEntries(COLUMNS.map(([property, column]) => [property, Reflect.get(row, column)])),
    )
}
