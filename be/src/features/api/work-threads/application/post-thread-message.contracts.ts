import type { MentionRef } from "@modules/domain/work-chains"
import type { Locale } from "@modules/platform/i18n"

/** What the PostThreadMessage operation takes. */
export interface PostThreadMessageRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The thread to write in. */
    readonly threadId: string
    /** What is written. */
    readonly body: string
    /** The tags the author chose; never read out of the text. */
    readonly mentions: ReadonlyArray<MentionRef>
    /** Customer words to quote as data. */
    readonly quoted: ReadonlyArray<string>
    /** The language of the texts the capability writes. */
    readonly locale: Locale
}
