import type { FieldValue } from "@modules/domain/decisions"
import type { Locale } from "@modules/platform/i18n"

/** What sending a command takes. */
export interface SendCommandRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The receiving module. */
    readonly to: string
    /** The command key of the receiver. */
    readonly command: string
    /** Why, in one line. */
    readonly reason: string
    /** The kind of record the command is about. */
    readonly subjectType?: string
    /** The record the command is about. */
    readonly subjectId?: string
    /** The customer the command is about. */
    readonly leadId?: string
    /** The other payload fields the command declares. */
    readonly fields?: ReadonlyArray<FieldValue>
    /** The language of the generated text. */
    readonly locale: Locale
}
