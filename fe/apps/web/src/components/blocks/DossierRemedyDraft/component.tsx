import { Alert, Button, Drawer, Form, Input, SectionHeader, Text, Textarea } from "@starci/grammar/common"
import type { PresentationState } from "@starci/grammar/common"
import { DossierStaticRows } from "@/components/leaves/DossierStaticRows"
import type { EvidenceItemView } from "@/components/leaves/DossierStaticRows"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { BODY_CLASS_NAME, FOOTER_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** The draft as the drawer draws it. */
interface DraftContent {
    readonly id: string
    readonly findingId: string
    readonly status: string
    readonly title: string
    readonly body: string
    readonly placeholders: ReadonlyArray<EvidenceItemView>
}

/** The id of the form the footer commits. */
const FORM_ID = "dossier-remedy-draft"

/** Where the draft stands when that is worth a line: being written, failed, filed or turned down. */
interface DraftNoticeView {
    readonly tone: PresentationState
    readonly title: string
    readonly description: string | undefined
}

/** Copy and values the draft drawer supplies. */
export interface DossierRemedyDraftBaseProps {
    readonly props: {
        readonly isOpen: boolean
        readonly title: string
        readonly closeLabel: string
        readonly note: string
        readonly titleFieldLabel: string
        readonly bodyFieldLabel: string
        readonly placeholdersTitle: string
        readonly evidenceTitle: string
        readonly findingTitle: string | null
        readonly evidence: ReadonlyArray<EvidenceItemView>
        readonly notice: DraftNoticeView | null
        readonly slot: DataSlot<DraftContent>
        readonly placeholder: DraftContent
        readonly slotLabels: SlotLabels
        /** The title and body as the person has them now, edits included. */
        readonly draftTitle: string
        readonly draftBody: string
        /** The owner or manager may edit and decide a draft that is proposed; everyone else reads. */
        readonly canDecide: boolean
        readonly isDirty: boolean
        readonly isPending: boolean
        readonly rejectLabel: string
        readonly saveLabel: string
        readonly approveLabel: string
    }
    readonly on: {
        readonly close: () => void
        readonly setTitle: (value: string) => void
        readonly setBody: (value: string) => void
        readonly save: () => void
        readonly reject: () => void
        readonly approve: () => void
        readonly retry: () => void
    }
}

/** The decision group: turn the draft down, keep the edits, or file it in the dossier. */
const Decision = (props: DossierRemedyDraftBaseProps) => {
    const view = props.props
    return (
        <div className={FOOTER_CLASS_NAME}>
            <Button size="sm" intent="neutral" isDisabled={view.isPending} onPress={props.on.reject}>
                {view.rejectLabel}
            </Button>
            <Button size="sm" intent="neutral" isDisabled={view.isPending || !view.isDirty} onPress={props.on.save}>
                {view.saveLabel}
            </Button>
            <Button size="sm" intent="commit" type="submit" form={FORM_ID} isPending={view.isPending}>
                {view.approveLabel}
            </Button>
        </div>
    )
}

/** The base props, the draft that is shown and whether it is drawn as geometry. */
interface DraftProps extends DossierRemedyDraftBaseProps {
    readonly draft: DraftContent
    readonly isSkeleton: boolean
}

/** The fields of the draft, the places left to fill, and the evidence it answers. */
const Draft = (props: DraftProps) => {
    const view = props.props
    const isReadOnly = !view.canDecide
    return (
        <div className={BODY_CLASS_NAME}>
            {view.notice === null ? null : (
                <Alert tone={view.notice.tone} title={view.notice.title} description={view.notice.description} />
            )}
            <Text tone="muted">{view.note}</Text>
            <Form id={FORM_ID} label={view.title} isPending={view.isPending} onSubmit={props.on.approve}>
                <div className={FORM_CLASS_NAME}>
                    <Input
                        id="dossier-remedy-title"
                        name="title"
                        label={view.titleFieldLabel}
                        value={view.draftTitle}
                        isReadOnly={isReadOnly}
                        isRequired
                        isSkeleton={props.isSkeleton}
                        onValueChange={props.on.setTitle}
                    />
                    <Textarea
                        id="dossier-remedy-body"
                        name="body"
                        label={view.bodyFieldLabel}
                        value={view.draftBody}
                        rows={16}
                        maxLength={40000}
                        isReadOnly={isReadOnly}
                        isRequired
                        isSkeleton={props.isSkeleton}
                        onValueChange={props.on.setBody}
                    />
                </div>
            </Form>
            {props.draft.placeholders.length === 0 ? null : (
                <div className={FORM_CLASS_NAME}>
                    <SectionHeader level={3} title={view.placeholdersTitle} />
                    <DossierStaticRows label={view.placeholdersTitle} items={props.draft.placeholders} />
                </div>
            )}
            {view.evidence.length === 0 ? null : (
                <div className={FORM_CLASS_NAME}>
                    <SectionHeader level={3} title={view.evidenceTitle} description={view.findingTitle ?? undefined} />
                    <DossierStaticRows label={view.evidenceTitle} items={view.evidence} />
                </div>
            )}
        </div>
    )
}

/**
 * Draws the draft NIVO wrote for a finding in a drawer from the trailing edge: the status, the words of the draft to edit, the
 * places left to fill before signing and the evidence it answers. Owners and managers reject, save or approve it; everyone else
 * reads it.
 */
export const DossierRemedyDraftBase = (props: DossierRemedyDraftBaseProps) => {
    const view = props.props
    return (
        <Drawer
            isOpen={view.isOpen}
            onOpenChange={(open) => {
                if (!open) props.on.close()
            }}
            title={view.title}
            closeLabel={view.closeLabel}
            placement="right"
            footer={view.canDecide ? <Decision {...props} /> : undefined}
        >
            <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
                {(draft, isSkeleton) => <Draft {...props} draft={draft} isSkeleton={isSkeleton} />}
            </SlotView>
        </Drawer>
    )
}
