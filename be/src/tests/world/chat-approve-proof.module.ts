import { Module, type DynamicModule } from "@nestjs/common"
import { ChatMessageProposeExecutorService } from "@modules/domain/chat-node-ports"
import { workbenchDoorProofModules } from "./workbench-door-proof.module"

@Module({ providers: [ChatMessageProposeExecutorService], exports: [ChatMessageProposeExecutorService] })
/** The executor of `chat-message.propose` over the engine of the door proof, with no graph-nodes registry: a spec calls it as a node would. */
class ChatProposeProofModule {}

/** The modules of a suite that proposes, approves and delivers a Chatbot reply on the engine, as the back end's role. */
export const chatApproveProofModules = (): Array<DynamicModule> => [
    ...workbenchDoorProofModules(),
    { module: ChatProposeProofModule, global: true },
]
