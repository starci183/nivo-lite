import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./contract-renewal.module-definition"
import { RenewPaidContractHandler } from "./application/renew-paid-contract.handler"

@Module({ providers: [RenewPaidContractHandler] })
/** The contract-renewal reactor: the handlers its consumers dispatch to. */
export class ContractRenewalModule extends ConfigurableModuleClass {}
