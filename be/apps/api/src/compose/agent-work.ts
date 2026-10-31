import type { DynamicModule } from "@nestjs/common"
import { AGENT_WORK_ERROR_KINDS, AGENT_WORK_MESSAGES, AgentWorkModule } from "@modules/domain/agent-work"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"

/** The agent work area of the API: the store that lets an agent be woken by an event or a clock and run one turn at a time per scope. */
export const agentWorkModules = (): Array<DynamicModule> => [AgentWorkModule.register({ isGlobal: true })]

/** The error kinds of the capabilities this group registers. */
export const agentWorkErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [AGENT_WORK_ERROR_KINDS]

/** The message bundles of the capabilities this group registers. */
export const agentWorkMessages: ReadonlyArray<MessageBundle> = [AGENT_WORK_MESSAGES]
