import { Module } from "@nestjs/common"
import { LeadsApiModule } from "../../leads.module"
import { AddResponsibilityController } from "./add-responsibility.controller"
import { AssignResponsibilityController } from "./assign-responsibility.controller"
import { RecordOutcomeController } from "./record-outcome.controller"
import { SaveContractController } from "./save-contract.controller"

@Module({
    imports: [LeadsApiModule],
    controllers: [
        RecordOutcomeController,
        AddResponsibilityController,
        AssignResponsibilityController,
        SaveContractController,
    ],
})
/** The HTTP transport of the leads feature. */
export class LeadsHttpModule {}
