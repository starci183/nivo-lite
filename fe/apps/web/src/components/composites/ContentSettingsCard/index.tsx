import { Alert, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import type { ContentNote, ContentT } from "@/hooks/content"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

const COMMAND_SLOT_LABELS: SlotLabels = { empty: "", forbidden: "", error: "", retry: "" }

interface ContentSettingsCardProps {
    readonly title: string
    readonly description: string
    readonly children: ReactNode
}

/** The shared surface and heading of editable content settings. */
export const ContentSettingsCard = (props: ContentSettingsCardProps) => (
    <SurfaceCard ariaLabel={props.title}>
        <div className={FORM_CLASS_NAME}>
            <SectionHeader level={2} title={props.title} description={props.description} />
            {props.children}
        </div>
    </SurfaceCard>
)

interface ContentCommandNoteProps {
    readonly note: ContentNote | null
    readonly closeLabel: string
    readonly onDismiss: () => void
}

/** Draws a content command's dismissible result or validation note. */
export const ContentCommandNote = (props: ContentCommandNoteProps) =>
    props.note ? (
        <Alert
            title={props.note.text}
            tone={props.note.tone === "ok" ? "affirmative" : "negative"}
            dismissLabel={props.closeLabel}
            onDismiss={props.onDismiss}
        />
    ) : null

/** Builds a pending announcement slot whose idle content renders nothing. */
export const getContentCommandProgressProps = (isPending: boolean, message: string) => {
    const slot: DataSlot<string | null> = { isLoading: isPending, items: null }
    return { slot, placeholder: message, labels: COMMAND_SLOT_LABELS }
}

/** Draws the command announcement selected by the slot recipe. */
export const renderContentCommandProgress = (message: string | null) =>
    message === null ? null : (
        <Text size="sm" live="polite">
            {message}
        </Text>
    )

/** Resolves settings errors in the same order for each editable row form. */
export const getContentSettingsError = (
    errors: { readonly message?: string; readonly root?: { readonly message?: string } } | undefined,
    rowMessage: string | undefined,
    t: ContentT,
) => errors?.message ?? errors?.root?.message ?? rowMessage ?? (errors ? t("err_input") : undefined)
