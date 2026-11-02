import {
    Badge,
    Button,
    DescriptionList,
    Dialog,
    Stack,
    Cluster,
    type BadgeTone,
    type DescriptionListItem,
} from "@starci/grammar/common"

/** One button of the dialog footer. */
type ActionView = {
    readonly id: string
    readonly label: string
    readonly intent: "neutral" | "destructive"
}

/** What the detail dialog of a booking draws and reports. */
type BookingDetailDialogProps = {
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly items: ReadonlyArray<DescriptionListItem>
    readonly customerHref?: string
    readonly customerLabel: string
    readonly next?: Pick<ActionView, "id" | "label">
    readonly actions: ReadonlyArray<ActionView>
    readonly isPending: boolean
    readonly onAction: (id: string) => void
    readonly onClose: () => void
}

/** What the next step of the dialog draws. */
type NextActionProps = {
    readonly next: Pick<ActionView, "id" | "label">
    readonly isPending: boolean
    readonly onAction: (id: string) => void
}

/** The one commit of the dialog: the next step of the booking. */
const NextAction = (props: NextActionProps) => (
    <Button size="sm" intent="commit" isDisabled={props.isPending} onPress={() => props.onAction(props.next.id)}>
        {props.next.label}
    </Button>
)

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
                    <Button size="sm" intent="neutral" href={props.customerHref}>
                        {props.customerLabel}
                    </Button>
                )}
                <Button size="sm" intent="neutral" onPress={props.onClose}>
                    {props.closeLabel}
                </Button>
                {props.next === undefined ? null : (
                    <NextAction next={props.next} isPending={props.isPending} onAction={props.onAction} />
                )}
                {props.actions.map((action) =>
                    action.intent === "destructive" ? (
                        <Button
                            key={action.id}
                            size="sm"
                            intent="destructive"
                            step="entry"
                            isDisabled={props.isPending}
                            onPress={() => props.onAction(action.id)}
                        >
                            {action.label}
                        </Button>
                    ) : (
                        <Button
                            key={action.id}
                            size="sm"
                            intent={action.intent}
                            isDisabled={props.isPending}
                            onPress={() => props.onAction(action.id)}
                        >
                            {action.label}
                        </Button>
                    ),
                )}
            </>
        }
    >
        <Stack gap="row">
            <Cluster gap="inline">
                <Badge tone={props.statusTone} isDot>
                    {props.statusLabel}
                </Badge>
            </Cluster>
            <DescriptionList layout="columns" items={props.items} />
        </Stack>
    </Dialog>
)
