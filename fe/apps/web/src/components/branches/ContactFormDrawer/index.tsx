import type { ReactNode } from "react"
import { Alert, Button, Drawer, Form, Stack } from "@starci/grammar/common"

/** What the contact form drawer draws and does. */
interface ContactFormDrawerProps {
    readonly id: string
    readonly isOpen: boolean
    readonly title: string
    readonly description?: string
    readonly closeLabel: string
    readonly cancelLabel: string
    readonly submitLabel: string
    readonly isPending: boolean
    /** The notice of a refused try, in place under the fields: its title and the words of the back end or of the form. */
    readonly notice?: { readonly title: string; readonly description: string }
    readonly onClose: () => void
    readonly onSubmit: () => void
    /** The fields of the form. */
    readonly fields: ReactNode
}

/** What a form drawer of a contact takes from its view and its words: the same seven facts for every form. */
interface ContactFormDrawerInput {
    readonly id: string
    readonly description?: string
    readonly view: { readonly isOpen: boolean; readonly isPending: boolean; readonly error: string | undefined }
    readonly copy: { readonly title: string; readonly submitLabel: string; readonly failTitle: string }
    readonly labels: { readonly cancel: string; readonly close: string }
    readonly on: { readonly close: () => void; readonly submit: () => void }
}

/** The props a form drawer takes, made once from a form's view and words so that no form repeats the list. */
export const contactFormDrawerPropsOf = (input: ContactFormDrawerInput): Omit<ContactFormDrawerProps, "fields"> => ({
    id: input.id,
    isOpen: input.view.isOpen,
    title: input.copy.title,
    ...(input.description === undefined ? {} : { description: input.description }),
    closeLabel: input.labels.close,
    cancelLabel: input.labels.cancel,
    submitLabel: input.copy.submitLabel,
    isPending: input.view.isPending,
    ...(input.view.error === undefined
        ? {}
        : { notice: { title: input.copy.failTitle, description: input.view.error } }),
    onClose: input.on.close,
    onSubmit: input.on.submit,
})

/** The drawer every form of a contact shares: the fields in one form, the failure in place, cancel and the one command at the foot. */
export const ContactFormDrawer = (props: ContactFormDrawerProps) => (
    <Drawer
        isOpen={props.isOpen}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.onClose()
        }}
        title={props.title}
        {...(props.description === undefined ? {} : { description: props.description })}
        closeLabel={props.closeLabel}
        footer={
            <>
                <Button intent="dismiss" isDisabled={props.isPending} onPress={props.onClose}>
                    {props.cancelLabel}
                </Button>
                <Button type="submit" form={props.id} intent="commit" isPending={props.isPending}>
                    {props.submitLabel}
                </Button>
            </>
        }
    >
        <Form id={props.id} label={props.title} onSubmit={props.onSubmit} isPending={props.isPending}>
            <Stack gap="row">
                {props.fields}
                {props.notice === undefined ? null : (
                    <Alert tone="negative" title={props.notice.title} description={props.notice.description} />
                )}
            </Stack>
        </Form>
    </Drawer>
)
