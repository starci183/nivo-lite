import { Badge, Button, DescriptionList, Dialog } from "@starci/grammar/common"
import type { BadgeTone, DescriptionListItem } from "@starci/grammar/common"
import { ROW_CLASS, STACK_CLASS } from "./classNames"

/** One button of the dialog footer. */
type ActionView = {
    readonly id: string
    readonly label: string
    readonly variant: "primary" | "outline" | "danger-soft"
}

/** What the detail dialog of a booking draws and reports. */
export type BookingDetailDialogProps = {
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly items: ReadonlyArray<DescriptionListItem>
    readonly customerHref?: string
    readonly customerLabel: string
    readonly actions: ReadonlyArray<ActionView>
    readonly isPending: boolean
    readonly onAction: (id: string) => void
    readonly onClose: () => void
}

/** The dialog of one booking: its facts, a link to the customer, and the actions its status allows. */
export const BookingDetailDialog = (props: BookingDetailDialogProps) => (
    <Dialog
        isOpen
        onOpenChange={(open) => {
            if (!open) props.onClose()
        }}
        size="md"
        title={props.title}
        description={props.description}
        closeLabel={props.closeLabel}
        footer={
            <>
                {props.customerHref === undefined ? null : (
                    <Button size="sm" variant="ghost" href={props.customerHref}>
                        {props.customerLabel}
                    </Button>
                )}
                <Button size="sm" variant="outline" onPress={props.onClose}>
                    {props.closeLabel}
                </Button>
                {props.actions.map((action) => (
                    <Button
                        key={action.id}
                        size="sm"
                        variant={action.variant}
                        isDisabled={props.isPending}
                        onPress={() => props.onAction(action.id)}
                    >
                        {action.label}
                    </Button>
                ))}
            </>
        }
    >
        <div className={STACK_CLASS}>
            <div className={ROW_CLASS}>
                <Badge tone={props.statusTone} isDot>
                    {props.statusLabel}
                </Badge>
            </div>
            <DescriptionList layout="columns" items={props.items} />
        </div>
    </Dialog>
)
