import { Alert, Button, Cluster, Drawer, Form, Input, Section, Stack, Text, Textarea } from "@starci/grammar/common"
import { DossierStaticRows } from "@/components/leaves/DossierStaticRows"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DossierRemedyDrawerProps, DraftContent } from "@/hooks/brain"

export type { DossierRemedyDrawerProps } from "@/hooks/brain"

/** The id of the form the footer commits. */
const FORM_ID = "dossier-remedy-draft"

/** The decision group: turn the draft down, keep the edits, or file it in the dossier. */
const Decision = (props: DossierRemedyDrawerProps) => {
    const view = props.props
    return (
        <Cluster gap="inline" align="center" justify="end">
            <Button size="sm" intent="neutral" isDisabled={view.isPending} onPress={props.on.reject}>
                {view.rejectLabel}
            </Button>
            <Button size="sm" intent="neutral" isDisabled={view.isPending || !view.isDirty} onPress={props.on.save}>
                {view.saveLabel}
            </Button>
            <Button size="sm" intent="commit" type="submit" form={FORM_ID} isPending={view.isPending}>
                {view.approveLabel}
            </Button>
        </Cluster>
    )
}

/** The base props, the draft that is shown and whether it is drawn as geometry. */
interface DraftProps extends DossierRemedyDrawerProps {
    readonly draft: DraftContent
    readonly isLoading: boolean
}

/** The fields of the draft, the places left to fill, and the evidence it answers. */
const Draft = (props: DraftProps) => {
    const view = props.props
    const isReadOnly = !view.canDecide
    return (
        <Stack gap="section">
            {view.notice === null ? null : (
                <Alert
                    tone={view.notice.tone}
                    title={view.notice.title}
                    {...(view.notice.description === undefined ? {} : { description: view.notice.description })}
                />
            )}
            <Text tone="muted">{view.note}</Text>
            <Form id={FORM_ID} label={view.title} isPending={view.isPending} onSubmit={props.on.approve}>
                <Stack gap="row">
                    <Input
                        id="dossier-remedy-title"
                        name="title"
                        label={view.titleFieldLabel}
                        value={view.draftTitle}
                        isReadOnly={isReadOnly}
                        isRequired
                        isLoading={props.isLoading}
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
                        isLoading={props.isLoading}
                        onValueChange={props.on.setBody}
                    />
                </Stack>
            </Form>
            {props.draft.placeholders.length === 0 ? null : (
                <Section title={view.placeholdersTitle} headingLevel={3}>
                    <DossierStaticRows label={view.placeholdersTitle} items={props.draft.placeholders} />
                </Section>
            )}
            {view.evidence.length === 0 ? null : (
                <Section
                    title={view.evidenceTitle}
                    headingLevel={3}
                    {...(view.findingTitle === null ? {} : { description: view.findingTitle })}
                >
                    <DossierStaticRows label={view.evidenceTitle} items={view.evidence} />
                </Section>
            )}
        </Stack>
    )
}

/**
 * Draws the draft NIVO wrote for a finding in a drawer from the trailing edge: the status, the words of the draft to edit, the
 * places left to fill before signing and the evidence it answers. Owners and managers reject, save or approve it; everyone else
 * reads it.
 */
export const DossierRemedyDrawer = (props: DossierRemedyDrawerProps) => {
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
            <SlotView
                slot={view.slot}
                placeholder={view.placeholder}
                labels={view.slotLabels}
                onRetry={props.on.retry}
                render={(draft, isLoading) => <Draft {...props} draft={draft} isLoading={isLoading} />}
            />
        </Drawer>
    )
}
