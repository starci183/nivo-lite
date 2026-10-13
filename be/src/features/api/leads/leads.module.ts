import { Module } from "@nestjs/common"
import { AddResponsibilityHandler } from "./application/add-responsibility.handler"
import { AssignResponsibilityHandler } from "./application/assign-responsibility.handler"
import { RecordOutcomeHandler } from "./application/record-outcome.handler"
import { SaveContractHandler } from "./application/save-contract.handler"

@Module({
    providers: [RecordOutcomeHandler, AddResponsibilityHandler, AssignResponsibilityHandler, SaveContractHandler],
})
/** The leads feature: the handlers of its application. */
export class LeadsApiModule {}
