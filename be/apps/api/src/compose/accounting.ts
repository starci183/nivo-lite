import type { DynamicModule } from "@nestjs/common"
import { OrdersGraphqlModule } from "@features/api/orders"
import { AccountingGraphqlModule } from "@features/api/accounting"
import { AdjustmentsGraphqlModule } from "@features/api/adjustments"
import {
    ACCOUNTING_ERROR_KINDS,
    ACCOUNTING_MESSAGES,
    AccountingModule,
    McpAccountingGatewayService,
} from "@modules/domain/accounting"
import { SupplierPayablesModule } from "@modules/domain/supplier-payables"
import { STAFF_ERROR_KINDS, STAFF_MESSAGES, StaffModule } from "@modules/domain/staff"
import {
    ACCOUNTING_ADJUSTMENTS_ERROR_KINDS,
    ACCOUNTING_ADJUSTMENTS_MESSAGES,
    AccountingAdjustmentsModule,
} from "@modules/domain/accounting-adjustments"
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
import {
    OFFICE_COMMAND_CANDIDATES_ERROR_KINDS,
    OFFICE_COMMAND_CANDIDATES_MESSAGES,
    OfficeCommandCandidatesModule,
} from "@modules/domain/office-command-candidates"
import { OFFICE_ROOMS_ERROR_KINDS, OFFICE_ROOMS_MESSAGES, OfficeRoomsModule } from "@modules/domain/office-rooms"
import { AI_TASKS_ERROR_KINDS, AI_TASKS_MESSAGES, AiTasksService } from "@modules/domain/ai-tasks"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The accounting area of the API, in registration order. */
export const accountingModules = (): Array<DynamicModule> => [
    OrdersModule.register({ isGlobal: true }),
    OrdersGraphqlModule.register({}),
    StaffModule.register({ isGlobal: true }),
    AccountingAdjustmentsModule.register({ isGlobal: true }),
    SupplierPayablesModule.register({ isGlobal: true }),
    AccountingModule.register({ isGlobal: true, gateway: McpAccountingGatewayService }),
    AccountingGraphqlModule.register({}),
    AdjustmentsGraphqlModule.register({}),
    InvoicesModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    EmailMessagesModule.register({ isGlobal: true }),
    WorkPerformersModule.register({ isGlobal: true, writer: AiTasksService }),
    OfficeCommandCandidatesModule.register({ isGlobal: true, reader: AiTasksService }),
    OfficeRoomsModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const accountingErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    EMAIL_MESSAGES_ERROR_KINDS,
    INVOICES_ERROR_KINDS,
    ORDERS_ERROR_KINDS,
    TRANSACTIONS_ERROR_KINDS,
    WORK_PERFORMERS_ERROR_KINDS,
    AI_TASKS_ERROR_KINDS,
    OFFICE_COMMAND_CANDIDATES_ERROR_KINDS,
    STAFF_ERROR_KINDS,
    ACCOUNTING_ERROR_KINDS,
    ACCOUNTING_ADJUSTMENTS_ERROR_KINDS,
    OFFICE_ROOMS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const accountingMessages: ReadonlyArray<MessageBundle> = [
    EMAIL_MESSAGES_MESSAGES,
    INVOICES_MESSAGES,
    ORDERS_MESSAGES,
    TRANSACTIONS_MESSAGES,
    WORK_PERFORMERS_MESSAGES,
    AI_TASKS_MESSAGES,
    OFFICE_COMMAND_CANDIDATES_MESSAGES,
    STAFF_MESSAGES,
    ACCOUNTING_MESSAGES,
    ACCOUNTING_ADJUSTMENTS_MESSAGES,
    OFFICE_ROOMS_MESSAGES,
]
