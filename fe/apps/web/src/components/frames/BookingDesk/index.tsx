import type { BookingDeskData, BookingDeskActions, BookingAgendaRowView } from "@/modules/types"
import { BookingDeskControls } from "@/components/composites/BookingDeskControls"
import { AlertDialog, Badge, Cluster, EmptyNotice, Section, Stack, type ListRowData } from "@starci/grammar/common"
import { BookingDetailDialog } from "@/components/composites/BookingDetailDialog"
import { BookingPlacementDialog } from "@/components/composites/BookingPlacementDialog"

type ReadyProps = BookingDeskData

/** Resolved agenda fields and atomic booking commands; the owning workbench retains all read statuses. */
type BookingDeskProps = ReadyProps & {
    readonly isLoading: boolean
    readonly onAdd: BookingDeskActions["onAdd"]
    readonly onPlacementChange: BookingDeskActions["onPlacementChange"]
    readonly onPlacementSubmit: BookingDeskActions["onPlacementSubmit"]
    readonly onPlacementClose: BookingDeskActions["onPlacementClose"]
    readonly onPrev: BookingDeskActions["onPrev"]
    readonly onNext: BookingDeskActions["onNext"]
    readonly onThisWeek: BookingDeskActions["onThisWeek"]
    readonly onPickDate: BookingDeskActions["onPickDate"]
    readonly onToggleCancelled: BookingDeskActions["onToggleCancelled"]
    readonly onDismissNotice: BookingDeskActions["onDismissNotice"]
    readonly onOpen: BookingDeskActions["onOpen"]
    readonly onAct: BookingDeskActions["onAct"]
    readonly onConfirmCancel: BookingDeskActions["onConfirmCancel"]
    readonly onKeepBooking: BookingDeskActions["onKeepBooking"]
    readonly onDetailAction: BookingDeskActions["onDetailAction"]
    readonly onCloseDetail: BookingDeskActions["onCloseDetail"]
}

/** Draws the agenda of the desk: the toolbar, the days with their bookings, and the dialogs the owner opens from them. */
export const BookingDesk = (props: BookingDeskProps) => {
    return (
        <Stack gap="row">
            <BookingDeskControls
                legend={props.legend}
                add={props.add}
                {...(props.nav === undefined ? {} : { nav: props.nav })}
                {...(props.notice === undefined ? {} : { notice: props.notice })}
                isPending={props.isPending}
                isLoading={props.isLoading}
                onAdd={props.onAdd}
                onPrev={props.onPrev}
                onNext={props.onNext}
                onThisWeek={props.onThisWeek}
                onPickDate={props.onPickDate}
                onToggleCancelled={props.onToggleCancelled}
                onDismissNotice={props.onDismissNotice}
            />
            {props.days.length === 0 ? (
                <Section
                    isLoading={props.isLoading}
                    kind="list"
                    ariaLabel={props.label}
                    empty={<EmptyNotice message={props.empty.title} description={props.empty.body} />}
                    items={[]}
                />
            ) : (
                props.days.map((day) => (
                    <Section
                        isLoading={props.isLoading}
                        key={day.id}
                        kind="list"
                        title={day.label}
                        items={day.rows.map((row) => bookingAgendaItem(row, props.isPending, props))}
                        empty={<EmptyNotice message={props.empty.title} description={props.empty.body} />}
                    />
                ))
            )}
            {props.detail === undefined ? null : (
                <BookingDetailDialog {...props.detail} onAction={props.onDetailAction} onClose={props.onCloseDetail} />
            )}
            {props.placement === undefined ? null : (
                <BookingPlacementDialog
                    {...props.placement}
                    onChange={props.onPlacementChange}
                    onSubmit={props.onPlacementSubmit}
                    onClose={props.onPlacementClose}
                />
            )}
            {props.cancel === undefined ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={(open) => {
                        if (!open) props.onKeepBooking()
                    }}
                    tone="negative"
                    title={props.cancel.title}
                    confirmLabel={props.cancel.confirmLabel}
                    cancelLabel={props.cancel.keepLabel}
                    onConfirm={props.onConfirmCancel}
                />
            )}
        </Stack>
    )
}

/** Keeps the booking's status, every flag and every quick action on its typed agenda row. */
const bookingAgendaItem = (
    row: BookingAgendaRowView,
    isPending: boolean,
    on: Pick<BookingDeskProps, "onOpen" | "onAct">,
): ListRowData => {
    const firstFlag = row.flags[0]
    const status = { label: row.status.text, tone: row.status.tone, isDot: true }
    return {
        id: row.id,
        title: row.time,
        description: [row.who, row.where].filter((part) => part !== "").join(" · "),
        badges: firstFlag === undefined ? [status] : [status, { label: firstFlag.text, tone: firstFlag.tone }],
        action: { label: row.time, intent: "neutral", press: () => on.onOpen(row.id) },
        ...(row.actions.length === 0
            ? {}
            : {
                  menu: {
                      label: row.time,
                      entries: row.actions.map((action) => ({
                          id: action.id,
                          label: action.label,
                          isDisabled: isPending,
                          onAction: () => on.onAct(row.id, action.id),
                      })),
                  },
              }),
        detail:
            row.flags.length < 2 ? null : (
                <Cluster gap="inline">
                    {row.flags.slice(1).map((flag) => (
                        <Badge key={flag.text} tone={flag.tone}>
                            {flag.text}
                        </Badge>
                    ))}
                </Cluster>
            ),
    }
}
