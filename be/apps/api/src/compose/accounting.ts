import type { DynamicModule } from "@nestjs/common"
import { OrdersGraphqlModule } from "@features/api/orders"
import { AccountingGraphqlModule } from "@features/api/accounting"
import { AdjustmentsGraphqlModule } from "@features/api/adjustments"
import { AccountingModule } from "@modules/domain/accounting"
import { StaffModule } from "@modules/domain/staff"
import { AccountingAdjustmentsModule } from "@modules/domain/accounting-adjustments"
import { EmailMessagesModule } from "@modules/domain/email-messages"
import { InvoicesModule } from "@modules/domain/invoices"
import { OrdersModule } from "@modules/domain/orders"
import { TransactionsModule } from "@modules/domain/transactions"
import { WorkPerformersModule } from "@modules/domain/work-performers"
import { OfficeCommandCandidatesModule } from "@modules/domain/office-command-candidates"
import { OfficeRoomsModule } from "@modules/domain/office-rooms"
import { DeepseekClient } from "@modules/integrations/deepseek"
/** The accounting area of the API, in registration order. */
export const accountingModules = (): Array<DynamicModule> => [
    OrdersModule.register({ isGlobal: true }),
    OrdersGraphqlModule.register({}),
    StaffModule.register({ isGlobal: true }),
    AccountingAdjustmentsModule.register({ isGlobal: true }),
    AccountingModule.register({ isGlobal: true }),
    AccountingGraphqlModule.register({}),
    AdjustmentsGraphqlModule.register({}),
    InvoicesModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    EmailMessagesModule.register({ isGlobal: true }),
    WorkPerformersModule.register({ isGlobal: true, writer: DeepseekClient }),
    OfficeCommandCandidatesModule.register({ isGlobal: true, reader: DeepseekClient }),
    OfficeRoomsModule.register({ isGlobal: true }),
]
