import type { DynamicModule } from "@nestjs/common"
import {
    AGENT_SCHEDULES_ERROR_KINDS,
    AGENT_SCHEDULES_MESSAGES,
    AgentSchedulesModule,
} from "@modules/domain/agent-schedules"
import { AGENT_RUNS_ERROR_KINDS, AGENT_RUNS_MESSAGES, AgentRunsModule } from "@modules/domain/agent-runs"
import { AGENT_WORK_ERROR_KINDS, AGENT_WORK_MESSAGES, AgentWorkModule } from "@modules/domain/agent-work"
import { AGENT_GRAPHS_ERROR_KINDS, AGENT_GRAPHS_MESSAGES } from "@modules/domain/agent-graphs"
import { CUSTOMER_INTENTS_MESSAGES } from "@modules/domain/customer-turns"
import {
    INTENT_CONTRACTS_ERROR_KINDS,
    INTENT_CONTRACTS_MESSAGES,
    IntentContractsModule,
} from "@modules/domain/intent-contracts"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"

/** The agent work area of the API: the store that lets an agent be woken by an event or a clock and run one turn at a time per scope, the durable run of each wake, and the clock that wakes it. */
export const agentWorkModules = (): Array<DynamicModule> => [
    AgentWorkModule.register({ isGlobal: true }),
    AgentRunsModule.register({ isGlobal: true }),
    IntentContractsModule.register({ isGlobal: true }),
    AgentSchedulesModule.register({ isGlobal: true, reactive: true }),
]

/** The error kinds of the capabilities this group registers. */
export const agentWorkErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_WORK_ERROR_KINDS,
    AGENT_RUNS_ERROR_KINDS,
    INTENT_CONTRACTS_ERROR_KINDS,
    AGENT_SCHEDULES_ERROR_KINDS,
    AGENT_GRAPHS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers. */
export const agentWorkMessages: ReadonlyArray<MessageBundle> = [
    AGENT_WORK_MESSAGES,
    AGENT_RUNS_MESSAGES,
    AGENT_SCHEDULES_MESSAGES,
    AGENT_GRAPHS_MESSAGES,
    INTENT_CONTRACTS_MESSAGES,
    CUSTOMER_INTENTS_MESSAGES,
]
