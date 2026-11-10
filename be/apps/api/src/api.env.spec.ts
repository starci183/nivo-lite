import { EnvSource } from "@modules/platform/config"
import { AgentThreadsErrorCode } from "@modules/domain/agent-threads"
import { LanggraphErrorCode } from "@modules/integrations/langgraph"
import { readApiEnv } from "./api.env"

/** The code a boot with this environment stops on. */
const bootStopOf = (values: Readonly<Record<string, string>>): unknown => {
    try {
        readApiEnv(new EnvSource(values))
        return null
    } catch (cause) {
        return typeof cause === "object" && cause !== null && "code" in cause ? cause.code : cause
    }
}

describe("the API environment and the engine on LangGraph", () => {
    it.each(["LANGSMITH_TRACING", "LANGSMITH_TRACING_V2", "LANGCHAIN_TRACING", "LANGCHAIN_TRACING_V2"])(
        "refuses to boot with the tracing switch %s set, before it reads anything else",
        (key) => {
            expect(bootStopOf({ [key]: "true" })).toBe(LanggraphErrorCode.TracingForbidden)
            expect(bootStopOf({ [key]: "false" })).toBe(LanggraphErrorCode.TracingForbidden)
        },
    )

    it("refuses to boot with an engine flag that names a workflow not cleared for threads", () => {
        expect(bootStopOf({ AGENT_ENGINE_LANGGRAPH: "sales.ghost" })).toBe(AgentThreadsErrorCode.FlagInvalid)
    })

    it("passes the guard and the flag with neither set, and with the front desk named: the boot stops on a later key", () => {
        const later = bootStopOf({})

        expect(later).not.toBeNull()
        expect(later).not.toBe(LanggraphErrorCode.TracingForbidden)
        expect(later).not.toBe(AgentThreadsErrorCode.FlagInvalid)
        expect(bootStopOf({ AGENT_ENGINE_LANGGRAPH: "chatbot.front-desk" })).toBe(later)
    })
})
