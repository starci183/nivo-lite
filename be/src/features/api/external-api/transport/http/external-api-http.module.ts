import { Module } from "@nestjs/common"
import { ExternalApiModule } from "../../external-api.module"
import { AddKnowledgeController } from "./add-knowledge.controller"
import { ConfigurableModuleClass } from "./external-api-http.module-definition"
import { ListEventsController } from "./list-events.controller"
import { SendMessageController } from "./send-message.controller"

@Module({
    imports: [ExternalApiModule.register({})],
    controllers: [AddKnowledgeController, ListEventsController, SendMessageController],
})
/** The HTTP transport of the external API feature. */
export class ExternalApiHttpModule extends ConfigurableModuleClass {}
