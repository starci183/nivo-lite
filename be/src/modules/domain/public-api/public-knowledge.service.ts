import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type {
    AcceptKnowledgeParams,
    AcceptedKnowledge,
    KnowledgeRequestBody,
    RecordedRequest,
} from "./public-api.contracts"
import { checkContent, cleanTags, dedupePrefix, visibilityOf } from "./public-api.policy"
import { INSERT_REQUEST } from "./persistence/public-api.sql"

@Injectable()
/** The knowledge the public API adds to the workspace of a key, reached only through the shared primary EntityManager; writing and indexing the source is a job. */
export class PublicKnowledgeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: PublicApiQueue,
        private readonly keys: ApiKeysService,
    ) {}

    /** Accepts a text knowledge source: the request is recorded in the ledger and its job is enqueued in one transaction. */
    async acceptKnowledge(params: AcceptKnowledgeParams): Promise<AcceptedKnowledge> {
        const who = await this.keys.authenticate("knowledge:write", params.authorization)
        const content = checkContent(params.content)
        if (content.kind === "refused") throw new PublicApiError({ code: content.code, params: content.params })
        const topic = params.topic ?? ""
        const body: KnowledgeRequestBody = {
            title: params.title,
            content: content.value,
            topic: topic === "" ? null : topic,
            tags: cleanTags(params.tags ?? []),
            visibility: visibilityOf(params),
            source: `api:${who.name}`,
        }
        return this.entityManager.transaction(async (tx) => {
            const [request] = await tx.query<Array<RecordedRequest>>(INSERT_REQUEST, [
                who.workspaceId,
                who.keyId,
                "knowledge",
                dedupePrefix("knowledge", who.keyId),
                "",
                JSON.stringify(body),
            ])
            if (request === undefined) throw new PublicApiError({ code: PublicApiErrorCode.NotWritten })
            await this.queue.enqueueRequest({ requestId: request.id, workspaceId: who.workspaceId }, tx)
            return { id: request.id, status: "queued" }
        })
    }
}
