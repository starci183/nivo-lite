import type { Provider } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { AgentRunsService } from "../../modules/domain/agent-runs/agent-runs.service"
import { AGENTS_INSTALLATIONS, type InstallationDirectory } from "@modules/domain/agents"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { CustomerFilesService } from "@modules/domain/chat-files"

/**
 * Peers that sit behind an owner under proof but are not what the proof is about, bound as quiet doubles: each answers as if nothing
 * happened (the scheduler is told, no agent is woken, no graph speaks), so a world composes without the capability they belong to.
 */

/** The one delivery function of the event pipeline: the entry keeps the event and it is delivered to nobody (no agent is woken, nothing is untaken). */
export const QUIET_PROVIDER_TRIGGERS: Provider = {
    provide: ProviderTriggersService,
    useFactory: () =>
        mock<ProviderTriggersService>({
            deliver: jest.fn().mockResolvedValue({ status: "delivered", events: 0, dropped: 0, woken: [], repeats: 0, untaken: 0, held: 0 }),
        }),
}

/** The customer files of a message: the proofs' messages carry no picture, so nothing is fetched or kept. */
export const QUIET_CUSTOMER_FILES: Provider = {
    provide: CustomerFilesService,
    useFactory: () => mock<CustomerFilesService>({ keep: jest.fn().mockResolvedValue([]) }),
}

/** The installations of the agents: no proof installs a module, so no agent has an installation to move a conversation to. */
export const QUIET_INSTALLATIONS: Provider = {
    provide: AGENTS_INSTALLATIONS,
    useFactory: () =>
        mock<InstallationDirectory>({
            byId: jest.fn().mockResolvedValue(null),
            firstOfModule: jest.fn().mockResolvedValue(null),
            ofAgent: jest.fn().mockResolvedValue(null),
            contextVersionOf: jest.fn().mockResolvedValue(null),
        }),
}

/** The durable runs of a wake: the customer road proofs read wakes and conversations, so opening a run is told as done and nothing is written. */
export const QUIET_RUNS: Provider = {
    provide: AgentRunsService,
    useFactory: () => mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(undefined) }),
}
