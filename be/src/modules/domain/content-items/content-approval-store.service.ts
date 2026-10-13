import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ContentApprovalDraft,
    ContentPublishedResult,
    ContentSubmissionSnapshot,
} from "./content-approval-store.contracts"
import type { ContentEvidence, PublishMark } from "./content-editor.contracts"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import type { InsertedRow } from "./persistence/content-items.rows"
import {
    APPROVE_CONTENT_SUBMISSION,
    CLAIM_CONTENT_SUBMISSION,
    MARK_CONTENT_PUBLISHED,
    REJECT_CONTENT_SUBMISSION,
} from "./persistence/content-approval-store.sql"

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
        this.requireWritten(
            await this.entityManager.query<Array<InsertedRow>>(CLAIM_CONTENT_SUBMISSION, [
                workspaceId,
                id,
                workItemId,
                JSON.stringify(evidence),
                JSON.stringify(snapshot.variants),
                snapshot.channels,
            ]),
        )
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
        this.requireWritten(
            await this.entityManager.query<Array<InsertedRow>>(APPROVE_CONTENT_SUBMISSION, [
                workspaceId,
                id,
                workItemId,
                by,
                draft,
                JSON.stringify(evidence),
                evidence.at,
            ]),
        )
    }

    /** Returns a rejected or failed gate's waiting post to draft. */
    async reject(workspaceId: string, id: string, workItemId: string, evidence: ContentEvidence): Promise<void> {
        this.requireWritten(
            await this.entityManager.query<Array<InsertedRow>>(REJECT_CONTENT_SUBMISSION, [
                workspaceId,
                id,
                workItemId,
                JSON.stringify(evidence),
            ]),
        )
    }

    /** Merges channel proof into an approved post and closes it when every channel is marked. */
    async markPublished(
        workspaceId: string,
        id: string,
        channel: string,
        mark: PublishMark,
        evidence: ContentEvidence,
    ): Promise<ContentPublishedResult> {
        const rows = await this.entityManager.query<Array<ContentPublishedResult>>(MARK_CONTENT_PUBLISHED, [
            workspaceId,
            id,
            channel,
            JSON.stringify(mark),
            JSON.stringify(evidence),
            mark.at,
        ])
        const row = rows[0]
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.WrongStatus })
        return row
    }

    private requireWritten(rows: ReadonlyArray<InsertedRow>): void {
        if (rows.length === 0) throw new ContentItemsError({ code: ContentItemsErrorCode.WrongStatus })
    }
}
