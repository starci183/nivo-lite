import { Injectable } from "@nestjs/common"
import { Equal, In, IsNull, Or } from "typeorm"
import type { EntityManager } from "typeorm"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeSourceEntity } from "@modules/domain/knowledge-sources"
import { ModuleContextVersionEntity } from "@modules/domain/module-context-versions"
import { ModuleInstallationEntity } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isJsonObject, trimmedText } from "./content-ai-prompt.policy"
import type { BrandMaterial } from "./content-ai-prompt.policy"

/** The most public sources a marketing prompt reads. */
const SOURCE_LIMIT = 40
/** The states in which a source is indexed and may be quoted. */
const QUOTABLE_STATUSES = ["ready", "extracting_facts"] as const

@Injectable()
/** Public marketing context; private sources and instance-only facts never reach these prompts. */
export class ContentBrandService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly authority: AuthorityService,
        private readonly facts: BrainFactsService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Reads the applied setup, house voice, public knowledge and facts. */
    async material(workspaceId: string): Promise<BrandMaterial> {
        const [shop, authority, setupRow, sources, facts] = await Promise.all([
            this.workspaces.nameOf(workspaceId),
            this.authority.load({ workspaceId }),
            this.entityManager
                .createQueryBuilder(ModuleInstallationEntity, "i")
                .select("v.snapshot", "snapshot")
                .innerJoin(
                    ModuleContextVersionEntity,
                    "v",
                    "v.id = i.active_context_version_id AND v.workspace_id = i.workspace_id",
                )
                .where("i.workspace_id = :workspaceId AND i.module_key = 'content'", { workspaceId })
                .orderBy("i.created_at")
                .limit(1)
                .getRawOne<{ snapshot: unknown }>(),
            this.entityManager.find(KnowledgeSourceEntity, {
                select: { title: true, topic: true, content: true },
                where: {
                    workspaceId,
                    visibility: "public",
                    status: In(QUOTABLE_STATUSES),
                    module: Or(IsNull(), Equal("content")),
                    installationId: IsNull(),
                },
                order: { createdAt: "ASC" },
                take: SOURCE_LIMIT,
            }),
            this.facts.forView(workspaceId, "customer", "content", null, 80),
        ])
        const snapshot = isJsonObject(setupRow?.snapshot) ? setupRow.snapshot : {}
        const evidence = (key: string): string => {
            const gates = isJsonObject(snapshot.gates) ? snapshot.gates : {}
            const gate = gates[key]
            return isJsonObject(gate) ? trimmedText(gate.evidence) : ""
        }
        return {
            shop,
            authority: {
                brandVoice: authority?.brand_voice ?? "",
                replyStyle: authority?.reply_style ?? "",
                limitsNote: authority?.limits_note ?? "",
            },
            setup: {
                summary: trimmedText(snapshot.summary),
                facts: Array.isArray(snapshot.facts)
                    ? snapshot.facts.flatMap((fact: unknown) =>
                          isJsonObject(fact) && typeof fact.text === "string" ? [fact.text] : [],
                      )
                    : [],
                tone: evidence("tone"),
                claimsLimits: evidence("claims_limits"),
                audience: evidence("audience"),
                channels: evidence("channels"),
            },
            sources: sources.map((source) => ({ title: source.title, topic: source.topic, content: source.content })),
            brainFacts: facts.map((fact) => ({
                subject: fact.subjectLabel,
                attribute: fact.attributeLabel,
                value: fact.value,
            })),
        }
    }
}
