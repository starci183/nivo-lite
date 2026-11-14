/** Log events of the provider triggers: ids and counts only. */
export enum ProviderTriggersLogEvent {
    /** One emission was handed on: the account, the trigger, how many events and who was woken. */
    Fired = "provider_triggers.fired",
    /** One delivery of the event pipeline was handed on: the source, the verb, how many events, who was woken, how many nobody took. */
    Delivered = "provider_triggers.delivered",
    /**
     * An event about a person reached a route a member of the shop holds (ruling R45): kept, correlated to nothing (`workspaceId`,
     * `routeId`, `verb`, `eventId`).
     */
    RouteHeld = "provider_triggers.route_held",
    /** One try of a hand-over threw; it is tried again while tries are left. */
    HandOverRetried = "provider_triggers.hand_over_retried",
    /** A run could not be started for an agent after its retries and was kept as dead. */
    Dead = "provider_triggers.dead",
    /** A dead event could not be kept. */
    DeadLost = "provider_triggers.dead_lost",
    /** A provider's emission failed as a whole; the provider's own work went on. */
    EmitFailed = "provider_triggers.emit_failed",
    /** An owner or manager turned the trigger of an account on or off: who, which account and trigger, on or off, caught up or not. */
    SwitchChanged = "provider_triggers.switch_changed",
    /** An owner or manager bound the decider of an account's trigger, or unbound it: who, which account and trigger, which agent. */
    DeciderBound = "provider_triggers.decider_bound",
}
