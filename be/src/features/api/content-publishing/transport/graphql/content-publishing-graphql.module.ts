import { Module } from "@nestjs/common"
import { ContentPublishingApiModule } from "../../content-publishing.module"
import { ConfigurableModuleClass } from "./content-publishing-graphql.module-definition"
import { MarkContentPublishedResolver } from "./mark-content-published.resolver"
import { SubmitContentForApprovalResolver } from "./submit-content-for-approval.resolver"

@Module({
    imports: [ContentPublishingApiModule.register({})],
    providers: [SubmitContentForApprovalResolver, MarkContentPublishedResolver],
})
/** GraphQL publishing resolvers over the existing approval and publication application. */
export class ContentPublishingGraphqlModule extends ConfigurableModuleClass {}
