import type { EntityManager } from "typeorm"
import { ModuleContextVersionEntity } from "@modules/domain/module-context-versions"
import { ModuleInstallationEntity } from "@modules/domain/module-installations"
import { NivoKnowledgeItemEntity } from "@modules/domain/nivo-knowledge"
import { VideoBrandKitEntity } from "@modules/domain/video-brand-kits"
import { VideoProjectEntity } from "@modules/domain/video-projects"
import { VideoRenderEntity } from "@modules/domain/video-renders"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import type { ScriptBase, ScriptProject, ScriptSetup, ScriptSource } from "../video-stored.contracts"

/** How many selected sources one script request reads. */
const SCRIPT_SOURCES_LIMIT = 12

/** How many house rules one script request reads. */
const SCRIPT_BASE_LIMIT = 20

/** The table of knowledge sources: its owner has not landed an entity yet. */
const KNOWLEDGE_SOURCES_TABLE = "public.knowledge_sources"

/** One project of the workspace with its render status, workspace name and brand name; locked against a second script request when `lock` is set. */
export const readScriptProject = (
    manager: EntityManager,
    workspaceId: string,
    projectId: string,
    lock: boolean,
): Promise<ScriptProject | undefined> => {
    const query = manager
        .createQueryBuilder(VideoProjectEntity, "p")
        .innerJoin(WorkspaceEntity, "w", "w.id = p.workspace_id")
        .leftJoin(VideoBrandKitEntity, "k", "k.workspace_id = p.workspace_id")
        .leftJoin(VideoRenderEntity, "r", "r.id = p.render_id")
        .select("p.id", "id")
        .addSelect("p.title", "title")
        .addSelect("p.goal", "goal")
        .addSelect("p.aspect", "aspect")
        .addSelect("p.target_seconds", "target_seconds")
        .addSelect("p.status", "status")
        .addSelect("p.inputs", "inputs")
        .addSelect("p.script_meta", "script_meta")
        .addSelect("p.updated_at", "updated_at")
        .addSelect("r.status", "render_status")
        .addSelect("w.name", "workspace_name")
        .addSelect("k.shop_name", "shop_name")
        .where("p.workspace_id = :workspaceId AND p.id = :projectId", { workspaceId, projectId })
        .limit(1)
    return (lock ? query.setLock("pessimistic_write", undefined, ["p"]) : query).getRawOne<ScriptProject>()
}

/** The public, readable video sources the project selected; none when nothing is selected. */
export const readScriptSources = async (
    manager: EntityManager,
    workspaceId: string,
    sourceIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<ScriptSource>> => {
    if (sourceIds.length === 0) return []
    return manager
        .createQueryBuilder()
        .select("s.title", "title")
        .addSelect("s.topic", "topic")
        .addSelect("s.content", "content")
        .from(KNOWLEDGE_SOURCES_TABLE, "s")
        .where("s.workspace_id = :workspaceId AND s.id = ANY(:sourceIds::uuid[]) AND s.visibility = 'public'", {
            workspaceId,
            sourceIds: [...sourceIds],
        })
        .andWhere("s.status IN ('ready', 'extracting_facts') AND (s.module IS NULL OR s.module = 'video')")
        .andWhere("s.installation_id IS NULL")
        .orderBy("s.created_at", "ASC")
        .limit(SCRIPT_SOURCES_LIMIT)
        .getRawMany<ScriptSource>()
}

/** The approved configuration of the oldest video installation of the workspace. */
export const readScriptSetup = (manager: EntityManager, workspaceId: string): Promise<Array<ScriptSetup>> =>
    manager
        .createQueryBuilder(ModuleInstallationEntity, "i")
        .innerJoin(
            ModuleContextVersionEntity,
            "v",
            "v.id = i.active_context_version_id AND v.workspace_id = i.workspace_id",
        )
        .select("v.snapshot", "snapshot")
        .where("i.workspace_id = :workspaceId AND i.module_key = 'video'", { workspaceId })
        .orderBy("i.createdAt", "ASC")
        .limit(1)
        .getRawMany<ScriptSetup>()

/** The house authority, escalation and tone rules of video and the core agent. */
export const readScriptBase = (manager: EntityManager): Promise<Array<ScriptBase>> =>
    manager
        .createQueryBuilder(NivoKnowledgeItemEntity, "n")
        .select("n.title", "title")
        .addSelect("n.body", "body")
        .where("n.module IN ('video', 'core') AND n.kind IN ('authority', 'escalation', 'tone')")
        .orderBy("n.module", "DESC")
        .addOrderBy("n.slug", "ASC")
        .limit(SCRIPT_BASE_LIMIT)
        .getRawMany<ScriptBase>()
