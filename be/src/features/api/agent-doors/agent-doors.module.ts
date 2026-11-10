import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-doors.module-definition"
import { ReadCareOptOutHandler } from "./application/read-care-opt-out.handler"
import { ReleaseConversationHandler } from "./application/release-conversation.handler"
import { SetCareOptOutHandler } from "./application/set-care-opt-out.handler"

@Module({ providers: [ReadCareOptOutHandler, SetCareOptOutHandler, ReleaseConversationHandler] })
/** The owner's doors on a customer: the shop's care opt-out, and "hand back to the agent" for a held conversation. */
export class AgentDoorsApiModule extends ConfigurableModuleClass {}
