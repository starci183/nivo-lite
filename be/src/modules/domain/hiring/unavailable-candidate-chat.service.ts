import { Injectable } from "@nestjs/common"
import { CandidateChat } from "./candidate-chat.port"

@Injectable()
/** Until the chat capability binds the real adapter, no message goes into a conversation and the caller falls back to email or a link the owner passes on. */
export class UnavailableCandidateChatService extends CandidateChat {
    /** Delivers nothing. */
    deliver(): Promise<boolean> {
        return Promise.resolve(false)
    }
}
