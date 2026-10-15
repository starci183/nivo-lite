/** Log events of the booking port adapters. */
export enum BookingPortsLogEvent {
    /** The channel push of a notice threw after the message was stored; the notice is kept and not repeated. */
    DeliveryFailed = "booking_ports.delivery_failed",
    /** The evidence line of a notice could not be written; the notice itself already went out. */
    EvidenceFailed = "booking_ports.evidence_failed",
}
