import { EnvSource } from "@modules/platform/config"
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

    it("passes the tracing guard with nothing set: the boot stops on a later key", () => {
        const later = bootStopOf({})

        expect(later).not.toBeNull()
        expect(later).not.toBe(LanggraphErrorCode.TracingForbidden)
    })
})
