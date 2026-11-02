"use client"
import { useBookingWorkbenchView } from "@/hooks/bookingWorkbench"
import { BookingWorkbenchBase } from "./component"
type BookingWorkbenchProps = Parameters<typeof useBookingWorkbenchView>[0]
/** Resolves the booking workbench world once and hands only atomic models and commands to its own twin. */
export const BookingWorkbench = (props: BookingWorkbenchProps) => {
    const view = useBookingWorkbenchView(props)
    return <BookingWorkbenchBase {...view} />
}
