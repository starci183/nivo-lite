import { EnvSource } from "@modules/platform/config"
import { parseAgentThreadsConfig } from "./agent-threads.config"
import { AgentThreadsError, AgentThreadsErrorCode } from "./errors/agent-threads.error"
import { THREAD_READY_WORKFLOWS } from "./thread-flag.policy"

describe("parseAgentThreadsConfig", () => {
    it("starts no workflow on a thread and leaves every tunable to its default when nothing is set", () => {
        expect(parseAgentThreadsConfig(new EnvSource({}))).toEqual({
            workflows: [],
            graphsMax: undefined,
            approvalDeadlineMs: undefined,
            ownerDeadlineMs: undefined,
            doors: true,
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

    it("boots with the phase-1 walk's flag: front desk, consult and reconcile", () => {
        expect(
            parseAgentThreadsConfig(
                new EnvSource({ AGENT_ENGINE_LANGGRAPH: "chatbot.front-desk,sales.consult,accounting.reconcile" }),
            ).workflows,
        ).toEqual(["chatbot.front-desk", "sales.consult", "accounting.reconcile"])
    })

    it("starts every cleared workflow's new runs on a thread with LangGraph as default engine, and only the flag's with legacy", () => {
        expect(parseAgentThreadsConfig(new EnvSource({ AGENT_ENGINE_DEFAULT: "langgraph" })).workflows).toEqual(
            THREAD_READY_WORKFLOWS,
        )
        expect(
            parseAgentThreadsConfig(new EnvSource({ AGENT_ENGINE_DEFAULT: "legacy", AGENT_ENGINE_LANGGRAPH: "sales.consult" }))
                .workflows,
        ).toEqual(["sales.consult"])
    })

    it("refuses by name a default engine that is none", () => {
        const read = () => parseAgentThreadsConfig(new EnvSource({ AGENT_ENGINE_DEFAULT: "on" }))

        expect(read).toThrow(expect.objectContaining({ code: AgentThreadsErrorCode.FlagInvalid, params: { name: "on" } }))
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
