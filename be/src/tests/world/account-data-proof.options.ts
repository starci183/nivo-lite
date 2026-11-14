import { Module, type DynamicModule } from "@nestjs/common"
import { AccountDataModule } from "@modules/domain/account-data"
import { ACCOUNT_DATA_CATALOG } from "@modules/domain/account-data-catalog"
import { ConnectionBindingsReadService } from "@modules/domain/connections"

@Module({ providers: [ConnectionBindingsReadService], exports: [ConnectionBindingsReadService] })
/** The connection lookup the account-data intake resolves an account with, over the world's database. */
class AccountDataBindingsProofModule {}

/** The real account-data capability of the app's catalog over the world's database: what a door proof writes its rows through. */
export const ACCOUNT_DATA_PROOF_MODULES: Array<DynamicModule> = [
    { module: AccountDataBindingsProofModule, global: true },
    AccountDataModule.withoutPages({ isGlobal: true, types: ACCOUNT_DATA_CATALOG }),
]
