import type { ReactNode } from "react"
import { Button, Dialog, Form, Stack } from "@starci/grammar/common"

/** What a lead dialog draws around its fields: its words, its state and the two commands of its footer. */
interface LeadDialogShellProps {
    readonly isOpen: boolean
    readonly title: string
    readonly description?: string
    readonly closeLabel: string
    readonly submitLabel: string
    readonly isPending: boolean
    readonly onClose: () => void
    readonly onSubmit: () => void
    readonly fields: ReactNode
}

/** The shell every lead dialog shares: a medium dialog that cannot be dismissed while it saves, with the way out first and the commit last. */
export const LeadDialogShell = (props: LeadDialogShellProps) => (
    <Dialog
        isOpen={props.isOpen}
        onOpenChange={(open) => {
            if (!open && !props.isPending) props.onClose()
        }}
        size="md"
        title={props.title}
        {...(props.description === undefined ? {} : { description: props.description })}
        closeLabel={props.closeLabel}
        isDismissable={!props.isPending}
        footer={
            <>
                <Button intent="dismiss" isDisabled={props.isPending} onPress={props.onClose}>
                    {props.closeLabel}
                </Button>
                <Button intent="commit" isPending={props.isPending} onPress={props.onSubmit}>
                    {props.submitLabel}
                </Button>
            </>
        }
    >
        <Form label={props.title} onSubmit={props.onSubmit} isPending={props.isPending}>
            <Stack gap="row">{props.fields}</Stack>
        </Form>
    </Dialog>
)
