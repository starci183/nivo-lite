import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, returnedRows, rowShape } from "@modules/platform/database"
import type {
    ContentApprovalDraft,
    ContentPublishedResult,
    ContentSubmissionSnapshot,
} from "./content-approval-store.contracts"
import type { ContentEvidence, PublishMark } from "./content-editor.contracts"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import { ContentItemEntity } from "./persistence/entities"

/** The history with one more line, kept to its newest sixty lines. */
const evidenceWith = (parameter: string): string =>
    `(SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array(:${parameter}::jsonb)) WITH ORDINALITY AS history(line, ord) WHERE ord > jsonb_array_length(evidence || jsonb_build_array(:${parameter}::jsonb)) - 60)`

/** The channel marks after one more mark is merged in. */
const MERGED_MARKS = "(published || jsonb_build_object(:channel::text, :mark::jsonb))"

@Injectable()
/** The guarded publishing transitions of content_items; gate decisions cannot approve a different post. */
export class ContentApprovalStoreService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Moves a complete draft to waiting approval and binds its gate item. */
    async claimSubmission(
        workspaceId: string,
        id: string,
        workItemId: string,
        evidence: ContentEvidence,
        snapshot: ContentSubmissionSnapshot,
    ): Promise<void> {
        const claimed = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .update()
            .set({ status: "waiting_approval", workItemId, evidence: () => evidenceWith("evidence") })
            .where({ workspaceId, id, status: "draft" })
            .andWhere("cardinality(channels) > 0 AND variants = :variants::jsonb AND channels = :channels::text[]")
            .andWhere(
                "NOT EXISTS (SELECT 1 FROM unnest(channels) channel WHERE btrim(coalesce(variants -> channel ->> 'text', '')) = '')",
            )
            .setParameters({
                evidence: JSON.stringify(evidence),
                variants: JSON.stringify(snapshot.variants),
                channels: [...snapshot.channels],
            })
            .returning("id")
            .execute()
        this.requireWritten(claimed.raw)
    }

    /** Applies a person's edited first-channel draft only to the waiting item that this work owns. */
    async approve(
        workspaceId: string,
        id: string,
        workItemId: string,
        by: string,
        draft: ContentApprovalDraft,
        evidence: ContentEvidence,
    ): Promise<void> {
        if (draft !== null && draft.trim() === "")
            throw new ContentItemsError({ code: ContentItemsErrorCode.TextMissing })
        const approved = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .update()
            .set({
                status: "approved",
                approvedBy: by,
                approvedAt: () => ":at::timestamptz",
                variants: () =>
                    "CASE WHEN :draft::text IS NULL THEN variants ELSE jsonb_set(variants, ARRAY[channels[1], 'text'], to_jsonb(:draft::text), true) END",
                evidence: () => evidenceWith("evidence"),
            })
            .where({ workspaceId, id, status: "waiting_approval", workItemId })
            .setParameters({ at: evidence.at, draft, evidence: JSON.stringify(evidence) })
            .returning("id")
            .execute()
        this.requireWritten(approved.raw)
    }

    /** Returns a rejected or failed gate's waiting post to draft. */
    async reject(workspaceId: string, id: string, workItemId: string, evidence: ContentEvidence): Promise<void> {
        const rejected = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .update()
            .set({ status: "draft", evidence: () => evidenceWith("evidence") })
            .where({ workspaceId, id, status: "waiting_approval", workItemId })
            .setParameter("evidence", JSON.stringify(evidence))
            .returning("id")
            .execute()
        this.requireWritten(rejected.raw)
    }

    /** Merges channel proof into an approved post and closes it when every channel is marked. */
    async markPublished(
        workspaceId: string,
        id: string,
        channel: string,
        mark: PublishMark,
        evidence: ContentEvidence,
    ): Promise<ContentPublishedResult> {
        const published = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .update()
            .set({
                published: () => MERGED_MARKS,
                status: () => `CASE WHEN ${MERGED_MARKS} ?& channels THEN 'published' ELSE status END`,
                publishedAt: () => `CASE WHEN ${MERGED_MARKS} ?& channels THEN :at::timestamptz ELSE published_at END`,
                evidence: () => evidenceWith("evidence"),
            })
            .where(
                "workspace_id = :workspaceId AND id = :id AND status IN ('approved', 'published') AND :channel = ANY(channels)",
                {
                    workspaceId,
                    id,
                },
            )
            .setParameters({
                channel,
                mark: JSON.stringify(mark),
                evidence: JSON.stringify(evidence),
                at: mark.at,
            })
            .returning(`id, status = 'published' AS "allDone"`)
            .execute()
        const [row] = returnedRows(published.raw, rowShape({ id: "string", allDone: "boolean" }))
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.WrongStatus })
        return { id: row.id, allDone: row.allDone }
    }

    private requireWritten(raw: unknown): void {
        if (returnedRows(raw, rowShape({ id: "string" })).length === 0)
            throw new ContentItemsError({ code: ContentItemsErrorCode.WrongStatus })
    }
}
