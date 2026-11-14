import { EnvSource } from "@modules/platform/config"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { agentLoopNodesOf, parseAgentLoopConfig } from "./graph-nodes.config"

/** What `run` throws, or undefined when it does not throw. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

describe("AGENT_LOOP", () => {
    it("names no node when it is not set or blank: the JSON loop runs every step", () => {
        expect(agentLoopNodesOf(undefined)).toEqual({ kind: "ok", nodes: [] })
        expect(agentLoopNodesOf("  ")).toEqual({ kind: "ok", nodes: [] })
        expect(parseAgentLoopConfig(new EnvSource({}))).toEqual({ nodes: [] })
    })

    it("reads the node ids after `prebuilt:`, each once", () => {
        expect(agentLoopNodesOf("prebuilt:accounting.match-payment, payment.settle,accounting.match-payment")).toEqual({
            kind: "ok",
            nodes: ["accounting.match-payment", "payment.settle"],
        })
        expect(parseAgentLoopConfig(new EnvSource({ AGENT_LOOP: "prebuilt:chatbot.answer" }))).toEqual({
            nodes: ["chatbot.answer"],
        })
    })

    it.each([
        ["another loop", "native:chatbot.answer", "native:chatbot.answer"],
        ["no id", "prebuilt:", "prebuilt:"],
        ["an id that is no node id", "prebuilt:chatbot.answer,Answer", "Answer"],
        ["a bare id", "chatbot.answer", "chatbot.answer"],
    ])("refuses %s, naming it, so the app does not start half switched", (_what, value, name) => {
        expect(agentLoopNodesOf(value)).toEqual({ kind: "invalid", name })
        expect(thrownBy(() => parseAgentLoopConfig(new EnvSource({ AGENT_LOOP: value })))).toEqual(
            expect.objectContaining({ code: GraphNodesErrorCode.AgentLoopFlagInvalid, params: { name } }),
        )
    })
})
