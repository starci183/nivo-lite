import { Module } from "@nestjs/common"
import { MarkContentPublishedHandler } from "./application/mark-content-published.handler"
import { SubmitContentForApprovalHandler } from "./application/submit-content-for-approval.handler"

@Module({
    providers: [SubmitContentForApprovalHandler, MarkContentPublishedHandler],
})
/** Application handlers of content submission and manual publication proof. */
export class ContentPublishingApiModule {}
