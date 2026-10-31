import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SourceBrief } from "./knowledge-sources.contracts"
import type {
    ChangedPublicSource,
    OriginSource,
    PublicSourceExcerpt,
    PublicSourceText,
} from "./knowledge-sources-read.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"

const isChangedPublicSource = (value: unknown): value is ChangedPublicSource =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "excerpt" in value &&
    typeof value.excerpt === "string" &&
    "changedAt" in value &&
    typeof value.changedAt === "string"

@Injectable()
/** Request-time reads of the shared public documents of a workspace for the capabilities that quote them, always bounded by the caller. */
export class KnowledgeSourcesReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The text of the given public documents a module may quote, oldest first, at most `limit`; none when no id is given. */
    publicTexts(
        workspaceId: string,
        module: string,
        sourceIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<PublicSourceText>> {
        if (sourceIds.length === 0) return Promise.resolve([])
        return this.sharedPublic(workspaceId, module)
            .select("s.title", "title")
            .addSelect("s.topic", "topic")
            .addSelect("s.content", "content")
            .andWhere("s.id = ANY(CAST(:sourceIds AS uuid[]))", { sourceIds: [...sourceIds] })
            .orderBy("s.created_at", "ASC")
            .limit(limit)
            .getRawMany<PublicSourceText>()
    }

    /** Every public document a module may quote, oldest first, at most `limit`. */
    allPublicTexts(workspaceId: string, module: string, limit: number): Promise<Array<PublicSourceText>> {
        return this.sharedPublic(workspaceId, module)
            .select("s.title", "title")
            .addSelect("s.topic", "topic")
            .addSelect("s.content", "content")
            .orderBy("s.created_at", "ASC")
            .limit(limit)
            .getRawMany<PublicSourceText>()
    }

    /** The public documents a module may quote that changed after `since`, oldest change first, each with its first `excerptChars` characters. */
    async changedPublicSince(
        workspaceId: string,
        module: string,
        since: string,
        excerptChars: number,
        limit: number,
    ): Promise<Array<ChangedPublicSource>> {
        const rows: ReadonlyArray<unknown> = await this.sharedPublic(workspaceId, module)
            .select("s.id", "id")
            .addSelect("s.title", "title")
            .addSelect("s.topic", "topic")
            .addSelect("left(s.content, CAST(:excerptChars AS integer))", "excerpt")
            .addSelect("to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')", "changedAt")
            .andWhere("s.updated_at > :since::timestamptz", { since })
            .setParameter("excerptChars", excerptChars)
            .orderBy("s.updated_at")
            .limit(limit)
            .getRawMany()
        return rows.filter(isChangedPublicSource)
    }

    /** The newest public documents a module may quote, each with a one-line excerpt of `excerptChars` characters, at most `limit`. */
    publicExcerpts(
        workspaceId: string,
        module: string,
        excerptChars: number,
        limit: number,
    ): Promise<Array<PublicSourceExcerpt>> {
        return this.sharedPublic(workspaceId, module)
            .select("s.id", "id")
            .addSelect("s.title", "title")
            .addSelect("s.topic", "topic")
            .addSelect(
                String.raw`left(regexp_replace(s.content, '\s+', ' ', 'g'), CAST(:excerptChars AS integer))`,
                "excerpt",
            )
            .setParameter("excerptChars", excerptChars)
            .orderBy("s.created_at", "DESC")
            .limit(limit)
            .getRawMany<PublicSourceExcerpt>()
    }

    /** The kind, title and topic of these sources of a workspace, for the passages a search found; an unknown id is left out. */
    async briefsOf(workspaceId: string, sourceIds: ReadonlyArray<string>): Promise<ReadonlyArray<SourceBrief>> {
        if (sourceIds.length === 0) return []
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { id: true, kind: true, title: true, topic: true },
            where: { workspaceId, id: In([...sourceIds]) },
            take: sourceIds.length,
        })
        return rows.map((row) => ({ id: row.id, kind: row.kind, title: row.title, topic: row.topic }))
    }

    /** The sources a workspace added from one origin (for example `google_drive`), newest change first, at most `limit`. */
    async ofOrigin(workspaceId: string, origin: string, limit: number): Promise<ReadonlyArray<OriginSource>> {
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { id: true, title: true, status: true, visibility: true, sizeBytes: true, updatedAt: true },
            where: { workspaceId, origin },
            order: { updatedAt: "DESC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            visibility: row.visibility,
            sizeBytes: row.sizeBytes,
            updatedAt: row.updatedAt.toISOString(),
        }))
    }

    /** The public, indexed documents of the workspace that every instance of the module may read. */
    private sharedPublic(workspaceId: string, module: string): SelectQueryBuilder<KnowledgeSourceEntity> {
        return this.entityManager
            .createQueryBuilder(KnowledgeSourceEntity, "s")
            .where("s.workspace_id = :workspaceId AND s.visibility = 'public'", { workspaceId })
            .andWhere("s.status IN ('ready', 'extracting_facts') AND (s.module IS NULL OR s.module = :module)", {
                module,
            })
            .andWhere("s.installation_id IS NULL")
    }
}
