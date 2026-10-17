import { Module } from "@nestjs/common"
import { N8nPipelinesApiModule } from "../../n8n-pipelines.module"
import { ConfigurableModuleClass } from "./n8n-pipelines-http.module-definition"
import { N8nPipelinesController } from "./n8n-pipelines.controller"

@Module({ imports: [N8nPipelinesApiModule.register({})], controllers: [N8nPipelinesController] })
/** The HTTP transport of the n8n-pipelines feature. */
export class N8nPipelinesHttpModule extends ConfigurableModuleClass {}
