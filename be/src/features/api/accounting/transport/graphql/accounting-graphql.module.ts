import { Module } from "@nestjs/common"
import { AccountingApiModule } from "../../accounting.module"
import { AccountingBookResolver } from "./accounting-book.resolver"
import { ConfigurableModuleClass } from "./accounting-graphql.module-definition"
import { AccountingLedgerResolver } from "./accounting-ledger.resolver"
import { AccountingWorkbenchResolver } from "./accounting-workbench.resolver"

@Module({
    imports: [AccountingApiModule.register({})],
    providers: [AccountingBookResolver, AccountingLedgerResolver, AccountingWorkbenchResolver],
})
/** The GraphQL doors of the accounting feature. */
export class AccountingGraphqlModule extends ConfigurableModuleClass {}
