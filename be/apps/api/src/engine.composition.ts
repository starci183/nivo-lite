import type { DynamicModule } from "@nestjs/common"
import {
    EMAIL_MESSAGES_ERROR_KINDS,
    EMAIL_MESSAGES_MESSAGES,
    EmailMessagesModule,
} from "@modules/domain/email-messages"
import { INVOICES_ERROR_KINDS, INVOICES_MESSAGES, InvoicesModule } from "@modules/domain/invoices"
import { ORDERS_ERROR_KINDS, ORDERS_MESSAGES, OrdersModule } from "@modules/domain/orders"
import { TRANSACTIONS_ERROR_KINDS, TRANSACTIONS_MESSAGES, TransactionsModule } from "@modules/domain/transactions"
import {
    WORK_PERFORMERS_ERROR_KINDS,
    WORK_PERFORMERS_MESSAGES,
    WorkPerformersModule,
} from "@modules/domain/work-performers"
import { DeepseekClient } from "@modules/integrations/deepseek"

/** The message bundles of the capabilities the work engine performs through. */
export const ENGINE_MESSAGES = [
    EMAIL_MESSAGES_MESSAGES,
    INVOICES_MESSAGES,
    ORDERS_MESSAGES,
    TRANSACTIONS_MESSAGES,
    WORK_PERFORMERS_MESSAGES,
]

/** The error kinds of the capabilities the work engine performs through. */
export const ENGINE_ERROR_KINDS = [
    EMAIL_MESSAGES_ERROR_KINDS,
    INVOICES_ERROR_KINDS,
    ORDERS_ERROR_KINDS,
    TRANSACTIONS_ERROR_KINDS,
    WORK_PERFORMERS_ERROR_KINDS,
]

/** The records the performers write (orders, invoices, payments, email) and the performers themselves, registered after the decisions capability. */
export const engineModules = (): Array<DynamicModule> => [
    OrdersModule.register({ isGlobal: true }),
    InvoicesModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    EmailMessagesModule.register({ isGlobal: true }),
    WorkPerformersModule.register({ isGlobal: true, writer: DeepseekClient }),
]
