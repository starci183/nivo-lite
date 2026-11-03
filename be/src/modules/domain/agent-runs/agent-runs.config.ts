import type { EnvSource } from "@modules/platform/config"
import type { AgentRunsOptions } from "./agent-runs.options"

/**
 * Reads the agent runs configuration. `APP_BUILD_ID` names the running build (a git sha or a release tag) so runs parked under an older build
 * are run again when it starts; `AGENT_RUNS_PARK_SWEEP_MINUTES` and `AGENT_RUNS_PARK_MAX_RESUMES` bound how often the machine tries a parked run.
 */
export const parseAgentRunsConfig = (env: EnvSource): AgentRunsOptions => ({
    buildId: env.has("APP_BUILD_ID") ? env.string("APP_BUILD_ID") : undefined,
    parkSweepMinutes: env.has("AGENT_RUNS_PARK_SWEEP_MINUTES") ? env.int("AGENT_RUNS_PARK_SWEEP_MINUTES") : undefined,
    parkMaxResumes: env.has("AGENT_RUNS_PARK_MAX_RESUMES") ? env.int("AGENT_RUNS_PARK_MAX_RESUMES") : undefined,
})
