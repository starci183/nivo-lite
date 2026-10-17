import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./bank-credit.module-definition"
import { BankCreditQueue } from "./bank-credit.queue"

@Module({ providers: [BankCreditQueue], exports: [BankCreditQueue] })
/** The bank-credit queue: its typed producer, imported by the domain module whose service enqueues. */
export class BankCreditModule extends ConfigurableModuleClass {}
