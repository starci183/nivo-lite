import { Injectable } from "@nestjs/common"
import type { OptionalLeadId } from "./agent-tools.contracts"
import type { ConversationLeads } from "./agent-tools.port"

@Injectable()
/** The conversation lookup of an app whose channels lane has not landed: no conversation is tied to a lead. */
export class UnboundConversationLeadsService implements ConversationLeads {
    /** No lead is known for the conversation. */
    leadIdOf(): Promise<OptionalLeadId> {
        return Promise.resolve(null)
    }
}
