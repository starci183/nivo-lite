import type { Provider } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { AgentRunsService } from "../../modules/domain/agent-runs/agent-runs.service"
import { AgentRunSweepService } from "../../modules/domain/agent-runs/agent-run-sweep.service"
import { AGENTS_INSTALLATIONS, type InstallationDirectory } from "@modules/domain/agents"
import { AgentTagService } from "../../modules/domain/agent-work/agent-tag.service"
import { CustomerIntakeService } from "../../modules/domain/conversations/customer-intake.service"

/**
 * Peers that sit behind an owner under proof but are not what the proof is about, bound as quiet doubles: each answers as if nothing
 * happened (the scheduler is told, no agent is woken, no graph speaks), so a world composes without the capability they belong to.
 */

/** The tag door of the agent work store: a tag is told as written, and no wake exists. */
export const QUIET_AGENT_TAGS: Provider = {
    provide: AgentTagService,
    useFactory: () =>
        mock<AgentTagService>({ tagAgent: jest.fn().mockResolvedValue({ tagged: true, wakeId: "quiet" }) }),
}

/** The customer intake of the conversations: the message is stored and no wake starts. */
export const QUIET_CUSTOMER_INTAKE: Provider = {
    provide: CustomerIntakeService,
    useFactory: () =>
        mock<CustomerIntakeService>({
            answer: jest.fn().mockResolvedValue(undefined),
        }),
}

/** The installations of the agents: no proof installs a module, so no agent has an installation to move a conversation to. */
export const QUIET_INSTALLATIONS: Provider = {
    provide: AGENTS_INSTALLATIONS,
    useFactory: () =>
        mock<InstallationDirectory>({
            byId: jest.fn().mockResolvedValue(null),
            firstOfModule: jest.fn().mockResolvedValue(null),
            ofAgent: jest.fn().mockResolvedValue(null),
            onOpenclaw: jest.fn().mockResolvedValue([]),
            contextVersionOf: jest.fn().mockResolvedValue(null),
        }),
}

/** The sweep of the durable runs: the road proofs open no run, so the minute's pass finds nothing to resume. */
export const QUIET_RUN_SWEEP: Provider = {
    provide: AgentRunSweepService,
    useFactory: () =>
        mock<AgentRunSweepService>({
            sweep: jest.fn().mockResolvedValue({ expired: 0, ready: 0, compensating: 0, unspoken: 0 }),
        }),
}

/** The durable runs of a wake: the customer road proofs read wakes and conversations, so opening a run is told as done and nothing is written. */
export const QUIET_RUNS: Provider = {
    provide: AgentRunsService,
    useFactory: () => mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(undefined) }),
}
