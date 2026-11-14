import type { ReactNode } from "react"
import { Button, Drawer, Form } from "@starci/grammar/common"

/** What the drawer draws and does. */
interface SandboxFormDrawerProps {
    /** The id of the form the footer's command submits. */
    readonly formId: string
    readonly isOpen: boolean
    readonly isPending: boolean
    readonly isSubmitDisabled: boolean
    readonly title: string
    readonly hint: string
    readonly cancelLabel: string
    readonly submitLabel: string
    readonly onClose: () => void
    readonly onSubmit: () => void
    /** The fields of the form. */
    readonly fields: ReactNode
}

/** What a form drawer of the page takes from its view and its words: the same facts for every form. */
interface SandboxFormDrawerInput {
    readonly formId: string
    readonly view: { readonly isOpen: boolean; readonly isPending: boolean }
    readonly isSubmitDisabled: boolean
    readonly copy: { readonly title: string; readonly hint: string; readonly submitLabel: string }
    readonly cancelLabel: string
    readonly on: { readonly close: () => void; readonly submit: () => void }
}

/** The props a form drawer takes, made once from a form's view and words so that no form repeats the list. */
export const sandboxFormDrawerPropsOf = (input: SandboxFormDrawerInput): Omit<SandboxFormDrawerProps, "fields"> => ({
    formId: input.formId,
    isOpen: input.view.isOpen,
    isPending: input.view.isPending,
    isSubmitDisabled: input.isSubmitDisabled,
    title: input.copy.title,
    hint: input.copy.hint,
    cancelLabel: input.cancelLabel,
    submitLabel: input.copy.submitLabel,
    onClose: input.on.close,
    onSubmit: input.on.submit,
})

/** The drawer of the Sandbox page's forms: a title with its line, the form, and at the foot the dismiss command and the one commit. */
export const SandboxFormDrawer = (props: SandboxFormDrawerProps) => (
    <Drawer
        isOpen={props.isOpen}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.onClose()
        }}
        title={props.title}
        description={props.hint}
        closeLabel={props.cancelLabel}
        footer={
            <>
                <Button intent="dismiss" isDisabled={props.isPending} onPress={props.onClose}>
                    {props.cancelLabel}
                </Button>
                <Button
                    type="submit"
                    form={props.formId}
                    intent="commit"
                    isPending={props.isPending}
                    isDisabled={props.isSubmitDisabled}
                >
                    {props.submitLabel}
                </Button>
            </>
        }
    >
        <Form id={props.formId} label={props.title} onSubmit={props.onSubmit} isPending={props.isPending}>
            {props.fields}
        </Form>
    </Drawer>
)
