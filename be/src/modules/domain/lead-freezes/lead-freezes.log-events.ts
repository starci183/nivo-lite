/** Log events of the freezes of customers: ids, codes and counts only, never the words of a customer. */
export enum LeadFreezesLogEvent {
    /** A wake of a held customer started no run; it waits as a pending event. */
    EventHeld = "lead_freezes.event_held",
    /** A wake of a customer whose thread run waits at an open stop started no run; it waits as a pending event of the stop's hold. */
    HeldForStop = "lead_freezes.held_for_stop",
    /** The customer was released and the pending events written again as wakes. */
    Released = "lead_freezes.released",
    /** A drive of a thread run ended but its hold could not be settled then; the next wake or sweep settles it. */
    SettleFailed = "lead_freezes.settle_failed",
}
