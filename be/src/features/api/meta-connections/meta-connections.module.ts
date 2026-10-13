import { Module } from "@nestjs/common"
import { MetaCallbackHandler } from "./application/meta-callback.handler"
import { MetaChallengeHandler } from "./application/meta-challenge.handler"
import { MetaAuthorizeHandler } from "./application/meta-authorize.handler"
import { ResumeMetaHandler } from "./application/resume-meta.handler"
import { ChooseMetaPageHandler } from "./application/choose-meta-page.handler"
import { CheckMetaHandler } from "./application/check-meta.handler"

@Module({
    providers: [
        MetaCallbackHandler,
        MetaChallengeHandler,
        MetaAuthorizeHandler,
        ResumeMetaHandler,
        ChooseMetaPageHandler,
        CheckMetaHandler,
    ],
})
/** The meta-connections feature: the handlers of its application. */
export class MetaConnectionsApiModule {}
