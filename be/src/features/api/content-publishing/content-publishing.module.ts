import { Module } from "@nestjs/common"
import { MarkContentPublishedHandler } from "./application/mark-content-published.handler"
import { SubmitContentForApprovalHandler } from "./application/submit-content-for-approval.handler"
import { ConfigurableModuleClass } from "./content-publishing.module-definition"

@Module({
    providers: [SubmitContentForApprovalHandler, MarkContentPublishedHandler],
})
/** Application handlers of content submission and manual publication proof. */
export class ContentPublishingApiModule extends ConfigurableModuleClass {}
