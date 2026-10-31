import type { UsageKind } from "./ai-usage-events.contracts"

const KINDS: Readonly<Record<UsageKind, UsageKind>> = {
    chat_reply: "chat_reply",
    setup: "setup",
    owner_chat: "owner_chat",
    relay: "relay",
    embedding: "embedding",
    engine: "engine",
    guide: "guide",
    brain: "brain",
    office_command: "office_command",
    agent_work: "agent_work",
}

const isUsageKind = (kind: string): kind is UsageKind => Object.hasOwn(KINDS, kind)

/** The usage kind a generation names; a kind the meter does not know is booked as engine work. */
export const usageKindOf = (kind: string): UsageKind => (isUsageKind(kind) ? kind : "engine")
