import type { Installation } from "@modules/domain/agents"
import type { CustomerTurn } from "@modules/domain/conversations"
import type { Passage } from "@modules/domain/knowledge"

/** The workspace of the runtime specs. */
export const RUNTIME_WS = "11111111-1111-4111-8111-111111111111"

/** An installation of the turn's agent with the given settings. */
export const runtimeInstallationOf = (settings: Installation["settings"] = {}): Installation => ({
    id: "inst-1",
    workspaceId: RUNTIME_WS,
    module: "chatbot",
    name: "Bot",
    isMulti: false,
    agentId: "a1",
    operatingMode: "assist",
    settings,
    activeContextVersionId: "version-1",
    liveEnabled: true,
    removed: false,
})

/** The customer turn the runtime specs answer. */
export const runtimeTurn: CustomerTurn = {
    conversation: {
        id: "c1",
        workspaceId: RUNTIME_WS,
        channel: "telegram",
        externalId: "42",
        connectionId: null,
        leadId: null,
        handledBy: null,
        visitorName: "Lan",
        installationId: "i1",
        agent: {
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Chatbot",
            module: "chatbot",
            instructions: "",
            knowledge: "",
            approvalRule: "",
            greeting: "",
        },
        speaksAs: null,
    },
    messageId: "m1",
    body: "How much is the tea?",
    channelEventId: "tg:42:1",
    transcript: [{ role: "user", body: "How much is the tea?" }],
}

/** A business passage a recall quotes. */
export const runtimePassageOf = (title: string): Passage => ({
    layer: "business",
    id: "chunk-1",
    sourceId: "src-1",
    module: "chatbot",
    kind: "document",
    title,
    content: "Tea 50k",
    score: 1,
    visibility: "public",
    topic: null,
})

/** Exact runtime booking refusals scenarios exercised by the runtime owner spec. */
export const RUNTIME_BOOKING_REFUSALS = [
    { label: "missing", value: undefined },
    { label: "null", value: null },
    { label: "array", value: [] },
    { label: "plain text", value: "book" },
    { label: "missing intent", value: {} },
    { label: "unknown intent", value: { intent: "confirm" } },
] as const

/** Exact runtime party size cases scenarios exercised by the runtime owner spec. */
export const RUNTIME_PARTY_SIZE_CASES = [
    { label: "missing", value: undefined, partySize: 1 },
    { label: "nonfinite", value: "Infinity", partySize: 1 },
    { label: "invalid", value: "several", partySize: 1 },
    { label: "zero", value: 0, partySize: 1 },
    { label: "negative", value: -2, partySize: 1 },
    { label: "fraction below one", value: 0.9, partySize: 1 },
    { label: "numeric string", value: "2.5", partySize: 3 },
    { label: "above the limit", value: 201, partySize: 200 },
] as const

/** Exact runtime readiness cases scenarios exercised by the runtime owner spec. */
export const RUNTIME_READINESS_CASES = [
    ["live" as const, { reply: "50k" }, 1],
    ["ready" as const, "installation_not_running", 0],
    ["removed" as const, "installation_not_running", 0],
    ["needs_connection" as const, "needs_connection", 0],
    ["setup" as const, "installation_not_running", 0],
] as const
