/** Log events of the automations capability. */
export enum AutomationsLogEvent {
    /** A pipeline failed on a business event; the other pipelines still ran. */
    EventFailed = "automations.event_failed",
    /** The scan of a template failed; the other scans still ran. */
    ScanFailed = "automations.scan_failed",
    /** The tick of an extension failed; the other extensions still ran. */
    ExtensionTickFailed = "automations.extension_tick_failed",
    /** An audit line could not be written; the change it describes was made. */
    AuditFailed = "automations.audit_failed",
}
