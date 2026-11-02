import { Alert, Drawer, Form, Input, Text, Textarea } from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { FORM_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected write form supplies. */
export interface PublicWriteFormBaseProps {
    readonly props: {
        readonly isOpen: boolean
        readonly isPending: boolean
        readonly title: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly submitLabel: string
        /** Says that what is written here is for customers, and that it is not a copy of an internal document. */
        readonly note: string
        readonly titleLabel: string
        readonly bodyLabel: string
        readonly docTitle: string
        readonly body: string
        readonly error?: string | undefined
        readonly failTitle: string
    }
    readonly on: {
        readonly close: () => void
        readonly submit: () => void
        readonly setTitle: (value: string) => void
        readonly setBody: (value: string) => void
    }
}

/** Draws the drawer in which the owner writes a public document by hand. */
export const PublicWriteFormBase = (props: PublicWriteFormBaseProps) => {
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
