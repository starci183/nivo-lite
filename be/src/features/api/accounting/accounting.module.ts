import { Module } from "@nestjs/common"
import { AccountingBookHandler } from "./application/accounting-book.handler"
import { AccountingLedgerHandler } from "./application/accounting-ledger.handler"
import { AccountingWorkbenchHandler } from "./application/accounting-workbench.handler"

@Module({ providers: [AccountingBookHandler, AccountingLedgerHandler, AccountingWorkbenchHandler] })
/** Registers the accounting CQRS handlers. */
export class AccountingApiModule {}
