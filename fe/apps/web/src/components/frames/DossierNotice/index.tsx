import { PaneSection } from "@starci/grammar/common"
import type { IconSource } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ChecklistImportDialog } from "@/components/composites/ChecklistImportDialog"
import type { ChecklistImportDialogProps } from "@/components/composites/ChecklistImportDialog"
import type { DossierDeskView } from "@/hooks/brain"

/** What the notice that takes the whole page says and calls. */
interface DossierNoticeProps {
    readonly list: DossierDeskView["list"]
    readonly copy: {
        readonly errorBody: string
        /** Said when the workspace holds no document: documents come first. */
        readonly emptyBody: string
        /** Said when documents wait for a catalogue: what a dossier catalogue is. */
        readonly catalogBody: string
        /** The way to add documents. */
        readonly emptyAction: string
    }
    /** The workspace holds a document: the page then asks for the import of a catalogue. */
    readonly hasDocuments: boolean
    readonly emptyIconSource: IconSource
    /** The import of a catalogue and its dialog while open; null for a member who may only read. */
    readonly checklist: { readonly label: string; readonly dialog: ChecklistImportDialogProps["props"] | null } | null
    readonly on: {
        readonly openSources: () => void
        readonly openImport: () => void
        readonly pickImport: (files: Array<File>) => void
        readonly confirmImport: () => void
        readonly closeImport: () => void
        readonly retry: () => void
    }
}

/** The way out of the empty page: the import of a catalogue when documents wait, else the addition of documents. */
const actionOf = (props: DossierNoticeProps) => {
    if (!props.hasDocuments) return { label: props.copy.emptyAction, onAction: props.on.openSources }
    return props.checklist === null ? null : { label: props.checklist.label, onAction: props.on.openImport }
}

/**
 * The notice that takes the whole page: no document yet (add some), documents without a catalogue (import one, with the dialog
 * it opens), or the page did not read.
 */
export const DossierNotice = (props: DossierNoticeProps) => {
    const action = actionOf(props)
    const { on } = props
    const dialog = props.checklist?.dialog ?? null
    return (
        <PaneSection align="center" grow>
            <SlotView
                slot={props.list.slot}
                placeholder={[]}
                labels={props.list.slotLabels}
                errorDescription={props.copy.errorBody}
                emptyDescription={props.hasDocuments ? props.copy.catalogBody : props.copy.emptyBody}
                emptyIconSource={props.emptyIconSource}
                {...(action === null ? {} : { emptyAction: action })}
                onRetry={on.retry}
                render={() => null}
            />
            {dialog === null ? null : (
                <ChecklistImportDialog
                    props={dialog}
                    on={{ pick: on.pickImport, confirm: on.confirmImport, close: on.closeImport }}
                />
            )}
        </PaneSection>
    )
}
