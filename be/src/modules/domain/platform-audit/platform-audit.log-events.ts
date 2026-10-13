/** Log events of the platform-audit capability. */
export enum PlatformAuditLogEvent {
    /** An audit row could not be written; the console went on without it. */
    WriteFailed = "platform_audit.write_failed",
}
