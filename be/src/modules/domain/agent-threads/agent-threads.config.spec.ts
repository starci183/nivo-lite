import { EnvSource } from "@modules/platform/config"
import { parseAgentThreadsConfig } from "./agent-threads.config"
import { AgentThreadsError, AgentThreadsErrorCode } from "./errors/agent-threads.error"

describe("parseAgentThreadsConfig", () => {
    it("starts no workflow on a thread and leaves every tunable to its default when nothing is set", () => {
        expect(parseAgentThreadsConfig(new EnvSource({}))).toEqual({
            workflows: [],
            graphsMax: undefined,
            approvalDeadlineMs: undefined,
            ownerDeadlineMs: undefined,
        })
    })

    it("reads the flag and the windows of the stops' deadlines", () => {
        expect(
            parseAgentThreadsConfig(
                new EnvSource({
                    AGENT_ENGINE_LANGGRAPH: "chatbot.front-desk",
                    AGENT_THREADS_APPROVAL_DEADLINE_MS: "60000",
                    AGENT_THREADS_OWNER_DEADLINE_MS: "120000",
                }),
            ),
        ).toMatchObject({ workflows: ["chatbot.front-desk"], approvalDeadlineMs: 60_000, ownerDeadlineMs: 120_000 })
    })

    it("refuses by name a workflow not cleared for threads", () => {
        const read = () => parseAgentThreadsConfig(new EnvSource({ AGENT_ENGINE_LANGGRAPH: "sales.nothing" }))

        expect(read).toThrow(AgentThreadsError)
        try {
            read()
        } catch (cause) {
            expect(cause instanceof AgentThreadsError ? cause.code : null).toBe(AgentThreadsErrorCode.FlagInvalid)
        }
    })
})
