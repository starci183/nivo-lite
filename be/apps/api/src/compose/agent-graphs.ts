import type { DynamicModule } from "@nestjs/common"
import { AccountingFactReaderService } from "@modules/domain/accounting"
import { AgentGraphsModule } from "@modules/domain/agent-graphs"
import {
    AGENT_TEMPLATES_ERROR_KINDS,
    AGENT_TEMPLATES_MESSAGES,
    AgentTemplatesModule,
} from "@modules/domain/agent-templates"
import {
    TEMPLATE_MARKETPLACE_ERROR_KINDS,
    TEMPLATE_MARKETPLACE_MESSAGES,
    TemplateMarketplaceModule,
} from "@modules/domain/template-marketplace"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
import { OrderFactReaderService } from "@modules/domain/orders"
import { GraphWorkDecisionService } from "@modules/domain/decisions"

/**
 * The action graph of the API: each agent as a flow the owner can read and change. It binds the branch decider of the work engine, the
 * intents of a turn and the data rights of the gateway. The accounting reader gives the amount of a supplier payment from the payment
 * itself and the orders reader the amount of an order from its record; a fact no reader owns is never read, so its decide point falls to its else until a module's reader is added to `readers`.
 */
export const agentGraphsModules = (): Array<DynamicModule> => [
    AgentGraphsModule.register({
        isGlobal: true,
        readers: [AccountingFactReaderService, OrderFactReaderService],
        workDecisions: GraphWorkDecisionService,
    }),
    AgentTemplatesModule.register({ isGlobal: true }),
    TemplateMarketplaceModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const agentGraphsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_TEMPLATES_ERROR_KINDS,
    TEMPLATE_MARKETPLACE_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const agentGraphsMessages: ReadonlyArray<MessageBundle> = [
    AGENT_TEMPLATES_MESSAGES,
    TEMPLATE_MARKETPLACE_MESSAGES,
]
