import { Alert, Drawer, Form, Input, Text, Textarea } from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import type { PublicWriteDrawerView } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

/** The words, values and commands of the drawer. */
interface PublicWriteDrawerProps {
    readonly props: PublicWriteDrawerView["props"]
    readonly on: PublicWriteDrawerView["on"]
}

/** Draws the drawer in which the owner writes a public document by hand. */
export const PublicWriteDrawer = (props: PublicWriteDrawerProps) => {
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
                        id="public-write-title"
                        name="title"
                        label={view.titleLabel}
                        isRequired
                        value={view.docTitle}
                        isDisabled={view.isPending}
                        onValueChange={props.on.setTitle}
                    />
                    <Textarea
                        id="public-write-body"
                        name="body"
                        label={view.bodyLabel}
                        rows={10}
                        isRequired
                        value={view.body}
                        isDisabled={view.isPending}
                        onValueChange={props.on.setBody}
                    />
                    {view.error === undefined ? null : (
                        <Alert tone="negative" title={view.failTitle} description={view.error} />
                    )}
                </div>
            </Form>
        </Drawer>
    )
}
