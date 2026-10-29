import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./inventory-deduction.module-definition"
import { DeductConfirmedOrderHandler } from "./application/deduct-confirmed-order.handler"

@Module({ providers: [DeductConfirmedOrderHandler] })
/** The inventory-deduction reactor: the handlers its consumers dispatch to. */
export class InventoryDeductionModule extends ConfigurableModuleClass {}
