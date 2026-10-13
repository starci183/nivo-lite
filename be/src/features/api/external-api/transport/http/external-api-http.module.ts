import { Module } from "@nestjs/common"
import { ExternalApiModule } from "../../external-api.module"
import { AddKnowledgeController } from "./add-knowledge.controller"
import { ListEventsController } from "./list-events.controller"
import { ListLeadsController } from "./list-leads.controller"
import { SendMessageController } from "./send-message.controller"
import { SubmitLeadController } from "./submit-lead.controller"

@Module({
    imports: [ExternalApiModule],
    controllers: [
        AddKnowledgeController,
        ListEventsController,
        ListLeadsController,
        SendMessageController,
        SubmitLeadController,
    ],
})
/** The HTTP transport of the external API feature. */
export class ExternalApiHttpModule {}
