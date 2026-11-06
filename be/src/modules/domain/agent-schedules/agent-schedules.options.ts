import type { Type } from "@nestjs/common"
import type { BackgroundVoice } from "./agent-schedules.contracts"

/** What the app root decides for the agent-schedules capability. */
export interface AgentSchedulesOptions {
    /**
     * True in the app that runs the agents' work: it adds the handler of `internal` and `schedule` wakes and the services that turn
     * internal events into wakes and seed a module's triggers. They need the turn, the inbox and the installations; a world that only
     * proves the clock leaves it off.
     */
    readonly reactive?: boolean
    /** The class that says an agent's background line to its owner (the Office), reused as it is registered; only the reactive app needs it. */
    readonly voice?: Type<BackgroundVoice>
}
