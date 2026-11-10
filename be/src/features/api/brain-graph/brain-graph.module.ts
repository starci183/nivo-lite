import { Module } from "@nestjs/common"
import { GetBrainGraphHandler } from "./application/get-brain-graph.handler"
import { LinkBrainFactsHandler } from "./application/link-brain-facts.handler"
import { UnlinkBrainFactsHandler } from "./application/unlink-brain-facts.handler"
import { ConfigurableModuleClass } from "./brain-graph.module-definition"

@Module({
    providers: [GetBrainGraphHandler, LinkBrainFactsHandler, UnlinkBrainFactsHandler],
})
/** The truth graph feature of the Second Brain page: the handlers of its application. */
export class BrainGraphApiModule extends ConfigurableModuleClass {}
