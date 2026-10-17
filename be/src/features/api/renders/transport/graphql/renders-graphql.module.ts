import { Module } from "@nestjs/common"
import { RendersApiModule } from "../../renders.module"
import { VideoRenderStatusResolver } from "./get-render-status.resolver"
import { ConfigurableModuleClass } from "./renders-graphql.module-definition"
import { RequestVideoRenderResolver } from "./request-render.resolver"

@Module({
    imports: [RendersApiModule.register({})],
    providers: [RequestVideoRenderResolver, VideoRenderStatusResolver],
})
/** The GraphQL transport of queued video renders and their progress. */
export class RendersGraphqlModule extends ConfigurableModuleClass {}
