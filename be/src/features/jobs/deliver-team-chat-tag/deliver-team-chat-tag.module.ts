import { Module } from "@nestjs/common"
import { TeamChatTagDeliveryService } from "@modules/domain/team-chat"
import { ConfigurableModuleClass } from "./deliver-team-chat-tag.module-definition"
import { DeliverTagStep } from "./steps/deliver-tag.step"

@Module({ providers: [TeamChatTagDeliveryService, DeliverTagStep], exports: [DeliverTagStep] })
/** The application of the team-chat-tag job: the delivery of the tag (api only) and its step; the queue transport module imports it. */
export class DeliverTeamChatTagModule extends ConfigurableModuleClass {}
