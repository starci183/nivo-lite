import type { LikenessUse } from "@modules/domain/agent-templates"

/** What the RecordTemplateLikeness operation takes. */
export interface RecordTemplateLikenessRequest {
    /** The template. */
    readonly templateKey: string
    /** The person. */
    readonly personName: string
    /** What of them the agent may use. */
    readonly allowedUses: ReadonlyArray<LikenessUse>
    /** The line shown to every customer. */
    readonly disclosure: string
    /** When the consent ends, ISO 8601, when it does. */
    readonly expiresAt?: string | undefined
}
