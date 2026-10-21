import type { Installation } from "@modules/domain/agents"
import type { CustomerTurn } from "@modules/domain/conversations"
import type { Passage } from "@modules/domain/knowledge"

/** The workspace of the runtime specs. */
export const RUNTIME_WS = "11111111-1111-4111-8111-111111111111"
/** The tool token a turn is given; it must never appear in anything stored or logged. */
export const RUNTIME_TOKEN = ["turn", "m1", "signed"].join(".")

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
    activeContextVersionId: null,
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

/** What a runtime spec varies. */
export interface RuntimeBuildOptions {
    /** Whether the OpenClaw gateway is configured. */
    readonly enabled?: boolean
    /** Whether the plan allowance is used up. */
    readonly blocked?: boolean
    /** The text the agent answers. */
    readonly text?: string
    /** The tool token minted for the turn; empty when no tool secret exists. */
    readonly token?: string
    /** Whether the agent holds connector grants. */
    readonly serves?: boolean
}
