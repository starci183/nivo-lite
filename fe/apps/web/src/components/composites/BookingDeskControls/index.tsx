import type { BookingDeskData, BookingDeskActions } from "@/modules/types"
import { BookingDeskNavigation } from "@/components/branches/BookingDeskNavigation"
import { Alert, Badge, Button, Cluster } from "@starci/grammar/common"

type ReadyProps = BookingDeskData

/** The booking desk toolbar resolves no world and owns its existing legend, add, range and notice anatomy. */
type BookingDeskControlsProps = Pick<ReadyProps, "legend" | "add" | "nav" | "notice" | "isPending"> & {
    readonly isLoading: boolean
    readonly onAdd: BookingDeskActions["onAdd"]
    readonly onPrev: BookingDeskActions["onPrev"]
    readonly onNext: BookingDeskActions["onNext"]
    readonly onThisWeek: BookingDeskActions["onThisWeek"]
    readonly onPickDate: BookingDeskActions["onPickDate"]
    readonly onToggleCancelled: BookingDeskActions["onToggleCancelled"]
    readonly onDismissNotice: BookingDeskActions["onDismissNotice"]
}

/** Draws the unchanged legend, add command, range navigation and dismissible command feedback. */
export const BookingDeskControls = (props: BookingDeskControlsProps) => {
    return (
        <>
            {" "}
            <Cluster gap="inline">
                {props.legend.map((item) => (
                    <Badge key={item.text} tone={item.tone} isDot>
                        {item.text}
                    </Badge>
                ))}
            </Cluster>
            <Cluster gap="inline">
                <Button
                    isLoading={props.isLoading}
                    size="sm"
                    intent="commit"
                    isDisabled={props.add.isDisabled}
                    onPress={props.onAdd}
                >
                    {props.add.label}
                </Button>
            </Cluster>
            {props.nav === undefined ? null : (
                <BookingDeskNavigation
                    props={props.nav}
                    isPending={props.isPending}
                    on={{
                        prev: props.onPrev,
                        next: props.onNext,
                        thisWeek: props.onThisWeek,
                        pickDate: props.onPickDate,
                        toggleCancelled: props.onToggleCancelled,
                    }}
                    isLoading={props.isLoading}
                />
            )}
            {props.notice === undefined ? null : (
                <Alert
                    key={props.notice.text}
                    tone={props.notice.tone}
                    title={props.notice.text}
                    dismissLabel={props.notice.dismissLabel}
                    onDismiss={props.onDismissNotice}
                />
            )}{" "}
        </>
    )
}
