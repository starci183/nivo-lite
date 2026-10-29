import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { PublicSourceExcerpt, PublicSourceText } from "./knowledge-sources-read.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the shared public documents of a workspace for the capabilities that quote them, always bounded by the caller. */
export class KnowledgeSourcesReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The text of the given public documents a module may quote, oldest first, at most `limit`; none when no id is given. */
    async publicTexts(
        workspaceId: string,
        module: string,
        sourceIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<PublicSourceText>> {
        if (sourceIds.length === 0) return []
        return this.sharedPublic(workspaceId, module)
            .select("s.title", "title")
            .addSelect("s.topic", "topic")
            .addSelect("s.content", "content")
            .andWhere("s.id = ANY(CAST(:sourceIds AS uuid[]))", { sourceIds: [...sourceIds] })
            .orderBy("s.created_at", "ASC")
            .limit(limit)
            .getRawMany<PublicSourceText>()
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
            .addSelect("left(regexp_replace(s.content, '\\s+', ' ', 'g'), CAST(:excerptChars AS integer))", "excerpt")
            .setParameter("excerptChars", excerptChars)
            .orderBy("s.created_at", "DESC")
            .limit(limit)
            .getRawMany<PublicSourceExcerpt>()
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
