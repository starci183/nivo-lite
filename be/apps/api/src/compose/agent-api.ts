import type { DynamicModule } from "@nestjs/common"
import { AgentToolsHttpModule } from "@features/api/agent-tools"
import { AgentsGraphqlModule } from "@features/api/agents"
import { DecisionsGraphqlModule } from "@features/api/decisions"
import { OfficeGraphqlModule } from "@features/api/office"
import { WorkThreadsGraphqlModule } from "@features/api/work-threads"
import { AGENTS_ERROR_KINDS, AGENTS_MESSAGES, AgentsService } from "@modules/domain/agents"
import {
    APPROVAL_REQUESTS_ERROR_KINDS,
    APPROVAL_REQUESTS_MESSAGES,
    ApprovalRequestsService,
} from "@modules/domain/approval-requests"
import {
    THREAD_MESSAGES_ERROR_KINDS,
    THREAD_MESSAGES_MESSAGES,
    ThreadMessagesModule,
} from "@modules/domain/thread-messages"
import { THREAD_WORK_ERROR_KINDS, THREAD_WORK_MESSAGES, ThreadWorkModule } from "@modules/domain/thread-work"
import { WORK_CHAINS_ERROR_KINDS, WORK_CHAINS_MESSAGES, WorkChainsModule } from "@modules/domain/work-chains"
import { WORK_THREADS_ERROR_KINDS, WORK_THREADS_MESSAGES, WorkThreadsModule } from "@modules/domain/work-threads"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The agent api area of the API, in registration order. */
export const agentApiModules = (): Array<DynamicModule> => [
    AgentsGraphqlModule.register({}),
    AgentToolsHttpModule.register({}),
    DecisionsGraphqlModule.register({}),
    OfficeGraphqlModule.register({}),
    WorkChainsModule.register({ isGlobal: true, ownerDirectory: AgentsService }),
    WorkThreadsModule.register({ isGlobal: true }),
    ThreadMessagesModule.register({ isGlobal: true, agentRules: AgentsService, approvalGate: ApprovalRequestsService }),
    ThreadWorkModule.register({ isGlobal: true }),
    WorkThreadsGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const agentApiErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENTS_ERROR_KINDS,
    APPROVAL_REQUESTS_ERROR_KINDS,
    WORK_CHAINS_ERROR_KINDS,
    WORK_THREADS_ERROR_KINDS,
    THREAD_MESSAGES_ERROR_KINDS,
    THREAD_WORK_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const agentApiMessages: ReadonlyArray<MessageBundle> = [
    AGENTS_MESSAGES,
    APPROVAL_REQUESTS_MESSAGES,
    WORK_CHAINS_MESSAGES,
    WORK_THREADS_MESSAGES,
    THREAD_MESSAGES_MESSAGES,
    THREAD_WORK_MESSAGES,
]
