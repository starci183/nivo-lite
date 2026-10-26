import { Module } from "@nestjs/common"
import { ChatMarkersApiModule } from "../../chatmarkers.module"
import { ConfigurableModuleClass } from "./chatmarkers-graphql.module-definition"
import { ChatMarkersResolver } from "./chat-markers.resolver"

@Module({
    imports: [ChatMarkersApiModule.register({})],
    providers: [ChatMarkersResolver],
})
/** GraphQL contract for delivery, read and mute states. */
export class ChatMarkersGraphqlModule extends ConfigurableModuleClass {}
