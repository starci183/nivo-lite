import type { DynamicModule } from "@nestjs/common"
import { AgentToolsHttpModule } from "@features/api/agent-tools"
import { AgentsGraphqlModule } from "@features/api/agents"
import { DecisionsGraphqlModule } from "@features/api/decisions"
import { AGENTS_ERROR_KINDS, AGENTS_MESSAGES } from "@modules/domain/agents"
import { APPROVAL_REQUESTS_ERROR_KINDS, APPROVAL_REQUESTS_MESSAGES } from "@modules/domain/approval-requests"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The agent api area of the API, in registration order. */
export const agentApiModules = (): Array<DynamicModule> => [
    AgentsGraphqlModule.register({}),
    DecisionsGraphqlModule.register({}),
    AgentToolsHttpModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const agentApiErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENTS_ERROR_KINDS,
    APPROVAL_REQUESTS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const agentApiMessages: ReadonlyArray<MessageBundle> = [AGENTS_MESSAGES, APPROVAL_REQUESTS_MESSAGES]
