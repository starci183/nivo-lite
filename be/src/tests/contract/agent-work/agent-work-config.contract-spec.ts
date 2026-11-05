import { EnvSource } from "@modules/platform/config"
import { parseAgentWorkConfig } from "@modules/domain/agent-work"

describe("parseAgentWorkConfig", () => {
    it("waits six seconds of quiet and at most twenty seconds in all by default", () => {
        expect(parseAgentWorkConfig(new EnvSource({}))).toEqual({ debounceMs: 6000, debounceMaxMs: 20_000 })
    })

    it("reads the window and the longest wait from the environment, and zero turns the window off", () => {
        expect(parseAgentWorkConfig(new EnvSource({ AGENT_BURST_WINDOW: "8s", AGENT_BURST_MAX_WAIT: "30s" }))).toEqual({
            debounceMs: 8000,
            debounceMaxMs: 30_000,
        })
        expect(parseAgentWorkConfig(new EnvSource({ AGENT_BURST_WINDOW: "0" })).debounceMs).toBe(0)
    })
})
