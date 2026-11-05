import { Alert, CheckboxGroup, Drawer, Form, Input, Link, Text, Textarea } from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { PublicPickerDrawerView } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

/** The words, values and commands of the drawer. */
interface PublicDraftPickerDrawerProps {
    readonly props: PublicPickerDrawerView["props"]
    readonly on: PublicPickerDrawerView["on"]
}

/** Draws the drawer that asks NIVO to draft a public document from internal documents. */
export const PublicDraftPickerDrawer = (props: PublicDraftPickerDrawerProps) => {
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
                    <Text size="sm">
                        <Link href={view.writeInstead.href}>{view.writeInstead.label}</Link>
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
