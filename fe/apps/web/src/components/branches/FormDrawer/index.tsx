import { Alert, Button, Drawer, Form } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { FORM_CLASS_NAME } from "./classNames"

/** The words, the state and the handlers of a drawer that holds one form, with its fields as children. */
interface FormDrawerProps {
    readonly isOpen: boolean
    readonly title: string
    readonly closeLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly error: string | null
    readonly isPending: boolean
    readonly canSave: boolean
    readonly onSubmit: () => void
    readonly onClose: () => void
    readonly children: ReactNode
}

/** A side drawer with one form: the failure alert over the fields, a save button that waits for the fields and a cancel. */
export const FormDrawer = (props: FormDrawerProps) => (
    <Drawer
        isOpen={props.isOpen}
        onOpenChange={(open) => {
            if (!open) props.onClose()
        }}
        title={props.title}
        closeLabel={props.closeLabel}
        placement="right"
        footer={(close) => (
            <>
                <Button
                    variant="primary"
                    isPending={props.isPending}
                    isDisabled={!props.canSave}
                    onPress={props.onSubmit}
                >
                    {props.saveLabel}
                </Button>
                <Button variant="ghost" onPress={close}>
                    {props.cancelLabel}
                </Button>
            </>
        )}
    >
        <Form label={props.title} onSubmit={props.onSubmit} isPending={props.isPending}>
            <div className={FORM_CLASS_NAME}>
                {props.error === null ? null : <Alert tone="negative" title={props.error} />}
                {props.children}
            </div>
        </Form>
    </Drawer>
)
