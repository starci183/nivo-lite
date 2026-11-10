import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CustomerDraftsService } from "@modules/domain/chat-node-ports"
import { workbenchDoorProofModules } from "./workbench-door-proof.module"

@Module({ providers: [CustomerDraftsService], exports: [CustomerDraftsService] })
/** The drafts of the customer send over the engine of the door proof: a spec stores a draft as the send does when the channel asks the owner first. */
class ChatProposeProofModule {}

/** The modules of a suite that proposes, approves and delivers a Chatbot reply on the engine, as the back end's role. */
export const chatApproveProofModules = (): Array<DynamicModule> => [
    ...workbenchDoorProofModules(),
    { module: ChatProposeProofModule, global: true },
]
