import { Module } from "@nestjs/common"
import { ContentPublishingApiModule } from "../../content-publishing.module"
import { MarkContentPublishedResolver } from "./mark-content-published.resolver"
import { SubmitContentForApprovalResolver } from "./submit-content-for-approval.resolver"

@Module({
    imports: [ContentPublishingApiModule],
    providers: [SubmitContentForApprovalResolver, MarkContentPublishedResolver],
})
/** GraphQL publishing resolvers over the existing approval and publication application. */
export class ContentPublishingGraphqlModule {}
