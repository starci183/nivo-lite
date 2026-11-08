import { Injectable } from "@nestjs/common"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import { ChatEntitiesService } from "./chat-entities.service"
import { CONVERSATION_ENTITY } from "./chat-conversation.policy"
import { candidateOf, onePerCustomer, profileDueQuery, profileValues, triedValues } from "./chat-profile.policy"
import type { ChatCustomerProfile, ChatProfileCandidate, ChatProfileDue } from "./chat-records.contracts"
import { ChatRecordsError, ChatRecordsErrorCode } from "./errors/chat-records.error"

/** How often a write starts again after another writer moved the conversation first. */
const WRITE_ATTEMPTS = 3

@Injectable()
/** The customer profiles of the conversations (name, picture and when each was read): which ones owe a read, and what a read or a failed try writes. */
export class ChatProfilesService {
    constructor(private readonly entities: ChatEntitiesService) {}

    /** The conversations of a connection that owe a profile, one per customer, the newest customers first. */
    due(workspaceId: string, due: ChatProfileDue): Promise<ReadonlyArray<ChatProfileCandidate>> {
        return this.entities.run(workspaceId, async (api) => {
            const page = await api.list(profileDueQuery(due))
            return onePerCustomer(page.rows.flatMap((found) => candidateOf(found)))
        })
    }

    /** Keeps what the channel said of the customer on the conversation: the name (when it gave one), the picture and the moment it was read. */
    record(workspaceId: string, conversationId: string, profile: ChatCustomerProfile, at: Date): Promise<void> {
        return this.entities.run(workspaceId, (api) =>
            this.write(api, conversationId, profileValues(profile, at), WRITE_ATTEMPTS),
        )
    }

    /** Keeps only that a read was tried and failed: the name stays as it is and the conversation waits for the next round. */
    tried(workspaceId: string, conversationId: string, at: Date): Promise<void> {
        return this.entities.run(workspaceId, (api) => this.write(api, conversationId, triedValues(at), WRITE_ATTEMPTS))
    }

    /** Writes the values on the conversation as it is now; a writer that moved it first makes the write start again. */
    private async write(
        api: EntitiesApi,
        id: string,
        values: Readonly<Record<string, string | null>>,
        attemptsLeft: number,
    ): Promise<void> {
        const row = await api.get(CONVERSATION_ENTITY, id)
        if (row === null) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotFound })
        const written = await api.update(CONVERSATION_ENTITY, id, row.version, values)
        if (written.ok) return
        if (written.reason !== "stale" || attemptsLeft <= 1)
            throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
        await this.write(api, id, values, attemptsLeft - 1)
    }
}
