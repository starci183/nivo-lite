import type { Dispatch, SetStateAction } from "react"
import type { useBookingRange, useBookingActions, useBookingPlacement, blankPlacementOf } from "@/hooks/bookingDesk"
import type { useTranslations, useFormatter } from "next-intl"
import { shiftDate } from "@/modules/i18n"
import { BookingDeskNavigation } from "@/components/composites/BookingDeskNavigation"
import { Alert, AlertDialog, Badge, EmptyNotice, SurfaceListCard, Button } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { BookingAgendaRow } from "@/components/composites/BookingAgendaRow"
import type { BookingAgendaRowView } from "@/components/composites/BookingAgendaRow"
import { BookingDetailDialog } from "@/components/composites/BookingDetailDialog"
import type { BookingDetailDialogProps } from "@/components/composites/BookingDetailDialog"
import { BookingPlacementDialog } from "@/components/composites/BookingPlacementDialog"
import type { BookingPlacementDialogProps } from "@/components/composites/BookingPlacementDialog"
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
            <div className={LEGEND_CLASS} role="group" aria-label={p.label}>
                {p.legend.map((item) => (
                    <Badge key={item.text} tone={item.tone} isDot>
                        {item.text}
                    </Badge>
                ))}
            </div>
            {p.add === undefined ? null : (
                <div className={TOOLBAR_CLASS}>
                    <Button size="sm" variant="primary" isDisabled={p.add.isDisabled} onPress={on.add}>
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

/** Draws the div section of the BookingDesk view. */

/** State and injected commands needed by the booking desk interactions. */
interface BookingDeskEventsInput {
    readonly openAdd: () => unknown
    readonly place: ReturnType<typeof useBookingPlacement>
    readonly range: ReturnType<typeof useBookingRange>
    readonly anchor: string
    readonly board: NonNullable<ReturnType<typeof useBookingRange>["board"]>
    readonly setShowCancelled: Dispatch<SetStateAction<boolean>>
    readonly desk: ReturnType<typeof useBookingActions>
    readonly setOpenId: Dispatch<SetStateAction<string | null>>
    readonly act: (id: string, action: string) => void
    readonly cancelId: string | null
    readonly setCancelId: Dispatch<SetStateAction<string | null>>
    readonly open: NonNullable<ReturnType<typeof useBookingRange>["board"]>["bookings"][number] | undefined
    readonly openMove: (id: string) => void
}

/** Maps the agenda controls and dialogs to the injected commands. */
export const buildBookingDeskEvents = (
    connected: BookingDeskEventsInput,
    moveAction: string,
): BookingDeskBaseProps["on"] => {
    const {
        openAdd,
        place,
        range,
        anchor,
        board,
        setShowCancelled,
        desk,
        setOpenId,
        act,
        cancelId,
        setCancelId,
        open,
        openMove,
    } = connected
    return {
        add: openAdd,
        placementChange: place.change,
        placementSubmit: place.submit,
        placementClose: place.close,
        prev: () => range.goto(shiftDate(anchor, -7)),
        next: () => range.goto(shiftDate(anchor, 7)),
        thisWeek: () => range.goto(board.today),
        pickDate: range.goto,
        toggleCancelled: setShowCancelled,
        dismissNotice: desk.dismiss,
        open: setOpenId,
        act,
        confirmCancel: () => {
            if (cancelId === null) return
            desk.act(cancelId, "cancel", () => {
                setCancelId(null)
                setOpenId(null)
            })
        },
        keepBooking: () => setCancelId(null),
        detailAction: (action) => {
            if (open === undefined) return
            if (action === moveAction) openMove(open.id)
            else act(open.id, action)
        },
        closeDetail: () => setOpenId(null),
    }
}

/** Derives the visible agenda and navigation copy from the supplied booking data. */
export const buildBookingDeskDisplay = (
    board: NonNullable<ReturnType<typeof useBookingRange>["board"]>,
    anchorValue: string,
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
    format: ReturnType<typeof useFormatter>,
    isToday: boolean,
    showCancelled: boolean,
    openId: string | null,
    cancelId: string | null,
    placement: typeof blankPlacementOf,
    loadingSuffix: string,
) => {
    const words = {
        say: t,
        resourceName: (id: string) => board.resources.find((resource) => resource.id === id)?.name ?? "",
        money: (value: number) =>
            format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    }
    const dayText = (date: string) =>
        format.dateTime(new Date(`${date}T12:00:00Z`), {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC",
        })
    const visible = board.bookings.filter(
        (booking) => (!isToday || booking.date === board.today) && (showCancelled || booking.status !== "cancelled"),
    )
    const open = board.bookings.find((booking) => booking.id === openId)
    const cancelling = board.bookings.find((booking) => booking.id === cancelId)
    const activeServices = board.services.filter((service) => service.active)
    const blank = placement(activeServices[0]?.id ?? "", board.today)
    const resourceOptions = board.resources
        .filter((resource) => resource.active)
        .map((resource) => ({ id: resource.id, label: resource.name }))
    const anchor = anchorValue === "" ? board.today : anchorValue
    const nav = {
        prevLabel: t("prev"),
        nextLabel: t("next"),
        thisWeekLabel: t("today"),
        dateLabel: t("pickDate"),
        date: anchor,
        showCancelledLabel: t("showCancelled"),
        showCancelled,
        rangeText: `${dayText(board.from)} - ${dayText(board.to)}${loadingSuffix}`,
    }
    return { words, dayText, visible, open, cancelling, activeServices, blank, resourceOptions, anchor, nav }
}

/** Builds the confirmation copy for the booking awaiting cancellation. */
export const buildBookingCancel = (
    cancelling: BookingDeskEventsInput["open"],
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
): Pick<BookingDeskBaseProps["props"], "cancel"> =>
    cancelling === undefined
        ? {}
        : {
              cancel: {
                  title: t("confirmCancelTitle", {
                      name: cancelling.customer === "" ? t("customerFallback") : cancelling.customer,
                  }),
                  confirmLabel: t("confirmCancelYes"),
                  keepLabel: t("confirmCancelKeep"),
              },
          }

/** Resolves the legend labels for each booking status tone. */
export const buildBookingLegend = (
    tones: Readonly<Record<string, BadgeTone>>,
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
): BookingDeskBaseProps["props"]["legend"] =>
    Object.entries(tones).map(([status, tone]) => ({
        text: t(`status_${status}`),
        tone,
    }))
