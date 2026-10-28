import { BookingDeskNavigation } from "@/components/composites/BookingDeskNavigation"
import {
    Alert,
    AlertDialog,
    Badge,
    EmptyNotice,
    List,
    ListItem,
    SurfaceListCard,
    Button,
    type BadgeTone,
} from "@starci/grammar/common"

import { BookingAgendaRow, type BookingAgendaRowView } from "@/components/composites/BookingAgendaRow"

import { BookingDetailDialog, type BookingDetailDialogProps } from "@/components/composites/BookingDetailDialog"

import {
    BookingPlacementDialog,
    type BookingPlacementDialogProps,
} from "@/components/composites/BookingPlacementDialog"

import { LEGEND_CLASS, STACK_CLASS, TOOLBAR_CLASS } from "./classNames"

/** The agenda of one day. */
export interface DayView {
    readonly id: string
    readonly label: string
    readonly rows: ReadonlyArray<BookingAgendaRowView>
}

/** Props for {@link BookingDeskBase}. */
export interface BookingDeskBaseProps {
    readonly props: {
        readonly label: string
        readonly legend: ReadonlyArray<{ readonly text: string; readonly tone: BadgeTone }>
        readonly add?: { readonly label: string; readonly isDisabled: boolean }
        readonly nav?: {
            readonly prevLabel: string
            readonly nextLabel: string
            readonly thisWeekLabel: string
            readonly dateLabel: string
            readonly date: string
            readonly showCancelledLabel: string
            readonly showCancelled: boolean
            readonly rangeText: string
        }
        readonly notice?: {
            readonly tone: "affirmative" | "negative"
            readonly text: string
            readonly dismissLabel: string
        }
        readonly days: ReadonlyArray<DayView>
        readonly empty: { readonly title: string; readonly body: string }
        readonly isPending: boolean
        readonly detail?: Omit<BookingDetailDialogProps, "onAction" | "onClose">
        readonly cancel?: { readonly title: string; readonly confirmLabel: string; readonly keepLabel: string }
        readonly placement?: Omit<BookingPlacementDialogProps, "onChange" | "onSubmit" | "onClose">
    }
    readonly on: {
        readonly add: () => void
        readonly placementChange: (patch: Partial<BookingPlacementDialogProps["fields"]>) => void
        readonly placementSubmit: () => void
        readonly placementClose: () => void
        readonly prev: () => void
        readonly next: () => void
        readonly thisWeek: () => void
        readonly pickDate: (date: string) => void
        readonly toggleCancelled: (value: boolean) => void
        readonly dismissNotice: () => void
        readonly open: (id: string) => void
        readonly act: (id: string, action: string) => void
        readonly confirmCancel: () => void
        readonly keepBooking: () => void
        readonly detailAction: (action: string) => void
        readonly closeDetail: () => void
    }
}

/** Draws the agenda of the desk: the toolbar, the days with their bookings, and the dialogs the owner opens from them. */
export const BookingDeskBase = (props: BookingDeskBaseProps) => {
    const { props: p, on } = props
    return (
        <div className={STACK_CLASS}>
            <List className={LEGEND_CLASS} label={p.label}>
                {p.legend.map((item) => (
                    <ListItem key={item.text}>
                        <Badge tone={item.tone} isDot>
                            {item.text}
                        </Badge>
                    </ListItem>
                ))}
            </List>
            {p.add === undefined ? null : (
                <div className={TOOLBAR_CLASS}>
                    <Button size="sm" intent="commit" isDisabled={p.add.isDisabled} onPress={on.add}>
                        {p.add.label}
                    </Button>
                </div>
            )}
            {p.nav === undefined ? null : <BookingDeskNavigation props={p.nav} isPending={p.isPending} on={on} />}
            {p.notice === undefined ? null : (
                <Alert
                    key={p.notice.text}
                    tone={p.notice.tone}
                    title={p.notice.text}
                    dismissLabel={p.notice.dismissLabel}
                    onDismiss={on.dismissNotice}
                />
            )}
            {p.days.length === 0 ? (
                <SurfaceListCard
                    ariaLabel={p.label}
                    empty={<EmptyNotice message={p.empty.title} description={p.empty.body} />}
                >
                    {[]}
                </SurfaceListCard>
            ) : (
                p.days.map((day) => (
                    <SurfaceListCard key={day.id} label={day.label}>
                        {day.rows.map((row) => (
                            <BookingAgendaRow
                                key={row.id}
                                row={row}
                                isPending={p.isPending}
                                onOpen={on.open}
                                onAction={on.act}
                            />
                        ))}
                    </SurfaceListCard>
                ))
            )}
            {p.detail === undefined ? null : (
                <BookingDetailDialog {...p.detail} onAction={on.detailAction} onClose={on.closeDetail} />
            )}
            {p.placement === undefined ? null : (
                <BookingPlacementDialog
                    {...p.placement}
                    onChange={on.placementChange}
                    onSubmit={on.placementSubmit}
                    onClose={on.placementClose}
                />
            )}
            {p.cancel === undefined ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={(open) => {
                        if (!open) on.keepBooking()
                    }}
                    tone="negative"
                    title={p.cancel.title}
                    confirmLabel={p.cancel.confirmLabel}
                    cancelLabel={p.cancel.keepLabel}
                    onConfirm={on.confirmCancel}
                />
            )}
        </div>
    )
}
