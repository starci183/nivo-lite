import { Alert } from "@starci/grammar/common"
import type { ContentNoteView } from "@/modules/types"

interface ContentCommandNoteProps {
    readonly note: ContentNoteView | null
    readonly closeLabel: string
    readonly onDismiss: () => void
}

/** Draws the existing content command outcome without owning the command or its lifetime. */
export const ContentCommandNote = (props: ContentCommandNoteProps) =>
    props.note ? (
        <Alert
            title={props.note.text}
            tone={props.note.tone === "ok" ? "affirmative" : "negative"}
            dismissLabel={props.closeLabel}
            onDismiss={props.onDismiss}
        />
    ) : null
