import { Module } from "@nestjs/common"
import { RendersApiModule } from "../../renders.module"
import { VideoRenderStatusResolver } from "./get-render-status.resolver"
import { RequestVideoRenderResolver } from "./request-render.resolver"

@Module({ imports: [RendersApiModule], providers: [RequestVideoRenderResolver, VideoRenderStatusResolver] })
/** The GraphQL transport of queued video renders and their progress. */
export class RendersGraphqlModule {}
