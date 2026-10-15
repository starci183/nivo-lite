/** Log events of the automation port adapters. */
export enum AutomationPortsLogEvent {
    /** A generation threw; the automation keeps its deterministic wording. */
    TextGenerationFailed = "automation_ports.text_generation_failed",
    /** An owner chat send failed; another connected bot may still deliver it. */
    OwnerChatSendFailed = "automation_ports.owner_chat_send_failed",
}
