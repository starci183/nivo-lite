import { Alert, CheckboxGroup, Drawer, Form, Input, Text, Textarea } from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

/** One internal document NIVO may draft from. */
interface SourceChoiceView {
    readonly id: string
    readonly label: string
}

/** Copy, values and state the connected picker supplies. */
export interface PublicDraftPickerBaseProps {
    readonly props: {
        readonly isOpen: boolean
        readonly isPending: boolean
        readonly title: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly submitLabel: string
        /** Says that NIVO reads internal documents with no customer present, and what it leaves out. */
        readonly note: string
        readonly titleLabel: string
        readonly sourcesLabel: string
        readonly sourcesHint: string
        readonly slotLabels: SlotLabels
        readonly instructionsLabel: string
        readonly sources: DataSlot<ReadonlyArray<SourceChoiceView>>
        readonly docTitle: string
        readonly selected: ReadonlyArray<string>
        readonly instructions: string
        readonly error?: string | undefined
        readonly failTitle: string
    }
    readonly on: {
        readonly close: () => void
        readonly submit: () => void
        readonly setTitle: (value: string) => void
        readonly setSelected: (ids: ReadonlyArray<string>) => void
        readonly setInstructions: (value: string) => void
        readonly retry: () => void
    }
}

/** Draws the drawer that asks NIVO to draft a public document from internal documents. */
export const PublicDraftPickerBase = (props: PublicDraftPickerBaseProps) => {
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
            footer={
                <DrawerFooter
                    cancelLabel={view.cancelLabel}
                    submitLabel={view.submitLabel}
                    isPending={view.isPending}
                    onCancel={props.on.close}
                    onSubmit={props.on.submit}
                />
            }
        >
            <Form label={view.title} onSubmit={props.on.submit} isPending={view.isPending}>
                <div className={FORM_CLASS_NAME}>
                    <Text size="sm" tone="muted">
                        {view.note}
                    </Text>
                    <Input
                        id="public-draft-title"
                        name="title"
                        label={view.titleLabel}
                        isRequired
                        value={view.docTitle}
                        isDisabled={view.isPending}
                        onValueChange={props.on.setTitle}
                    />
                    <SlotView
                        slot={view.sources}
                        placeholder={[{ id: "source-placeholder", label: "-" }]}
                        labels={view.slotLabels}
                        onRetry={props.on.retry}
                        render={(sources, isLoading) => (
                            <CheckboxGroup
                                label={view.sourcesLabel}
                                description={view.sourcesHint}
                                name="sources"
                                options={sources.map((one) => ({ value: one.id, label: one.label }))}
                                value={[...view.selected]}
                                isDisabled={view.isPending || isLoading}
                                isLoading={isLoading}
                                onValueChange={props.on.setSelected}
                            />
                        )}
                    />
                    <Textarea
                        id="public-draft-instructions"
                        name="instructions"
                        label={view.instructionsLabel}
                        rows={3}
                        value={view.instructions}
                        isDisabled={view.isPending}
                        onValueChange={props.on.setInstructions}
                    />
                    {view.error === undefined ? null : (
                        <Alert tone="negative" title={view.failTitle} description={view.error} />
                    )}
                </div>
            </Form>
        </Drawer>
    )
}
