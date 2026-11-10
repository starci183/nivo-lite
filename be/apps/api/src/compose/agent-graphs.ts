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
import { GraphWorkDecisionService } from "@modules/domain/decisions"
import { LEAD_FREEZES_ERROR_KINDS, LEAD_FREEZES_MESSAGES, LeadFreezesModule } from "@modules/domain/lead-freezes"
import { LEAD_MEMORY_ERROR_KINDS, LEAD_MEMORY_MESSAGES, LeadMemoryModule } from "@modules/domain/lead-memory"

/**
 * The action graph of the API: each agent as a flow the owner can read and change. It binds the branch decider of the work engine, the
 * intents of a turn and the data rights of the gateway. The accounting reader gives the amount of a supplier payment from the payment
 * itself; a fact no reader owns is never read, so its decide point falls to its else until a module's reader is added to `readers`.
 */
export const agentGraphsModules = (): Array<DynamicModule> => [
    AgentGraphsModule.register({
        isGlobal: true,
        readers: [AccountingFactReaderService],
        workDecisions: GraphWorkDecisionService,
    }),
    AgentTemplatesModule.register({ isGlobal: true }),
    TemplateMarketplaceModule.register({ isGlobal: true }),
    // A run that failed for good freezes its customer: the gate of the graph flows holds every new run of theirs until the owner acts.
    LeadFreezesModule.register({ isGlobal: true }),
    // One memory per customer across every workflow: node outputs, triggers and the facts nodes proved; refs read it at run time.
    LeadMemoryModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const agentGraphsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_TEMPLATES_ERROR_KINDS,
    TEMPLATE_MARKETPLACE_ERROR_KINDS,
    LEAD_FREEZES_ERROR_KINDS,
    LEAD_MEMORY_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const agentGraphsMessages: ReadonlyArray<MessageBundle> = [
    AGENT_TEMPLATES_MESSAGES,
    TEMPLATE_MARKETPLACE_MESSAGES,
    LEAD_FREEZES_MESSAGES,
    LEAD_MEMORY_MESSAGES,
]
