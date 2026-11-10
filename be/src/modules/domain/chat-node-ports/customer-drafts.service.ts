import { Injectable } from "@nestjs/common"
import { q } from "@nivo-lite/agent-sdk/query"
import type { EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ChatNodePortsError, ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const MESSAGE = "chat.message"

/** A draft to a customer, as the conversation keeps it. */
export interface CustomerDraft {
    /** The line. */
    readonly id: string
    /** `proposed` while it waits for the owner, `posted` once approved, `rejected` once turned down. */
    readonly status: string
    /** The words as they stand (the owner may have changed them when approving). */
    readonly text: string
}

/** A call's draft, or null when the call wrote none. */
export type OptionalCustomerDraft = CustomerDraft | null

/** A draft to store. */
export interface NewDraft {
    /** The conversation. */
    readonly conversationId: string
    /** The words. */
    readonly text: string
    /** The call that drafted it: a retry of the same call finds the same draft. */
    readonly key: string
}

/** The channel reference a draft is kept under: one draft per call. */
const draftRefOf = (key: string): string => `draft:${key}`

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const draftOf = (row: RecordRow): CustomerDraft => ({
    id: row.id,
    status: textOf(row.data["status"]),
    text: textOf(row.data["text"]),
})

@Injectable()
/**
 * The drafts of messages to customers that wait for the owner (the channel's access mode is "ask"): each is a `chat.message` of the
 * conversation with the status `proposed`, role agent, author ai, sending nothing; the owner approves it with `chatbot.approve-and-send`
 * (which posts and delivers it) or turns it down with `chatbot.reject-proposal`. A conversation holds at most one proposed line, so a new
 * draft takes over the words of the line that waits. Each draft is kept under the key of the call that wrote it, so a retry of that call
 * reads what the owner decided.
 */
export class CustomerDraftsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
    ) {}

    /** The draft one call wrote, or null when it wrote none. */
    draftOf(workspaceId: string, key: string): Promise<OptionalCustomerDraft> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const row = await this.keyed(this.ports.entitiesApi((use) => use(tx), "action"), key)
            return row === null ? null : draftOf(row)
        })
    }

    /** Stores the draft, or takes over the proposed line that waits in the conversation, and answers it. */
    propose(turn: NodeTurn, draft: NewDraft): Promise<CustomerDraft> {
        const at = this.clock.now().toISOString()
        const channelRef = draftRefOf(draft.key)
        return this.engine.scoped(turn.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const known = await this.keyed(api, draft.key)
            if (known !== null) return draftOf(known)
            const waiting = await api.list({
                from: MESSAGE,
                select: ["text", "status"],
                where: q.and(q.eq("conversationId", draft.conversationId), q.eq("status", "proposed")),
                order: [
                    ["sentAt", "desc"],
                    ["id", "desc"],
                ],
                page: { size: 1 },
            })
            const [line] = waiting.rows
            const fields = { text: draft.text, sentAt: at, channelRef, sentBy: turn.agentId }
            const written =
                line === undefined
                    ? await api.insert(
                          MESSAGE,
                          {
                              conversationId: draft.conversationId,
                              role: "agent",
                              authorKind: "ai",
                              status: "proposed",
                              ...fields,
                          },
                          { conversation: draft.conversationId },
                      )
                    : await api.update(MESSAGE, line.row.id, line.row.version, fields)
            if (!written.ok) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ProposalRefused })
            return { id: written.row.id, status: "proposed", text: draft.text }
        })
    }

    private async keyed(api: EntitiesApi, key: string): Promise<RecordRow | null> {
        const page = await api.list({
            from: MESSAGE,
            select: ["text", "status"],
            where: q.eq("channelRef", draftRefOf(key)),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        return page.rows[0]?.row ?? null
    }
}
