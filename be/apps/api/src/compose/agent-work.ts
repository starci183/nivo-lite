import type { DynamicModule } from "@nestjs/common"
import {
    AGENT_SCHEDULES_ERROR_KINDS,
    AGENT_SCHEDULES_MESSAGES,
    AgentSchedulesModule,
} from "@modules/domain/agent-schedules"
import { AGENT_WORK_ERROR_KINDS, AGENT_WORK_MESSAGES, AgentWorkModule } from "@modules/domain/agent-work"
import { AGENT_GRAPHS_ERROR_KINDS, AGENT_GRAPHS_MESSAGES } from "@modules/domain/agent-graphs"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"

/** The agent work area of the API: the store that lets an agent be woken by an event or a clock and run one turn at a time per scope, and the clock that wakes it. */
export const agentWorkModules = (): Array<DynamicModule> => [
    AgentWorkModule.register({ isGlobal: true }),
    AgentSchedulesModule.register({ isGlobal: true, reactive: true }),
]

/** The error kinds of the capabilities this group registers. */
export const agentWorkErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_WORK_ERROR_KINDS,
    AGENT_SCHEDULES_ERROR_KINDS,
    AGENT_GRAPHS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers. */
export const agentWorkMessages: ReadonlyArray<MessageBundle> = [
    AGENT_WORK_MESSAGES,
    AGENT_SCHEDULES_MESSAGES,
    AGENT_GRAPHS_MESSAGES,
]
