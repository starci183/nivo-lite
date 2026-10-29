import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./bank-credit-settlement.module-definition"
import { SettleBankCreditHandler } from "./application/settle-bank-credit.handler"

@Module({ providers: [SettleBankCreditHandler] })
/** The bank-credit-settlement reactor: the handlers its consumers dispatch to. */
export class BankCreditSettlementModule extends ConfigurableModuleClass {}
