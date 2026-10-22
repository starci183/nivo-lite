import { Module } from "@nestjs/common"
import { ListWorkThreadsHandler } from "./application/list-work-threads.handler"
import { ReadWorkThreadHandler } from "./application/read-work-thread.handler"
import { ReadWorkChainHandler } from "./application/read-work-chain.handler"
import { ReadMentionDirectoryHandler } from "./application/read-mention-directory.handler"
import { CreateWorkThreadHandler } from "./application/create-work-thread.handler"
import { PostThreadMessageHandler } from "./application/post-thread-message.handler"
import { DecideThreadApprovalHandler } from "./application/decide-thread-approval.handler"
import { ConfigurableModuleClass } from "./work-threads.module-definition"

@Module({
    providers: [
        ListWorkThreadsHandler,
        ReadWorkThreadHandler,
        ReadWorkChainHandler,
        ReadMentionDirectoryHandler,
        CreateWorkThreadHandler,
        PostThreadMessageHandler,
        DecideThreadApprovalHandler,
    ],
})
/** The work-threads feature: the handlers of its application. */
export class WorkThreadsApiModule extends ConfigurableModuleClass {}
