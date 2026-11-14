import type { DynamicModule } from "@nestjs/common"
import { AgentGraphsModule } from "@modules/domain/agent-graphs"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
import { CONTACTS_ERROR_KINDS, CONTACTS_MESSAGES, ContactsModule } from "@modules/domain/contacts"
import { CUSTOMER_ROUTES_ERROR_KINDS, CUSTOMER_ROUTES_MESSAGES, CustomerRoutesModule } from "@modules/domain/customer-routes"
import { LEAD_MEMORY_ERROR_KINDS, LEAD_MEMORY_MESSAGES, LeadMemoryModule } from "@modules/domain/lead-memory"

/**
 * The action graph of the API: each agent as a flow the owner can read and change. It binds the intents of a turn and the data rights
 * of the gateway. A fact no reader owns is never read, so its decide point falls to its else until
 * a module's reader is added to `readers`.
 */
export const agentGraphsModules = (): Array<DynamicModule> => [
    AgentGraphsModule.register({ isGlobal: true }),
    // A run that failed for good freezes its customer: the gate of the graph flows holds every new run of theirs until the owner acts.
    // One memory per customer across every workflow: node outputs, triggers and the facts nodes proved; refs read it at run time.
    LeadMemoryModule.register({ isGlobal: true }),
    // The engine's contacts: every person the agents work with, their identities, merges and audit (the engine's subject).
    ContactsModule.register({ isGlobal: true }),
    // The routes of the customers (one opaque id per person and entrance) and the delivery ledger of every agent's customer messages.
    CustomerRoutesModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const agentGraphsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    LEAD_MEMORY_ERROR_KINDS,
    CONTACTS_ERROR_KINDS,
    CUSTOMER_ROUTES_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const agentGraphsMessages: ReadonlyArray<MessageBundle> = [
    LEAD_MEMORY_MESSAGES,
    CONTACTS_MESSAGES,
    CUSTOMER_ROUTES_MESSAGES,
]
