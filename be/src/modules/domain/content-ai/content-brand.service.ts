import { Injectable } from "@nestjs/common"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import type { VersionSnapshot } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { trimmedText } from "./content-ai-prompt.policy"
import type { BrandMaterial } from "./content-ai-prompt.policy"

/** The most public sources a marketing prompt reads. */
const SOURCE_LIMIT = 40

@Injectable()
/** Public marketing context; private sources and instance-only facts never reach these prompts. */
export class ContentBrandService {
    constructor(
        private readonly authority: AuthorityService,
        private readonly facts: BrainFactsService,
        private readonly sources: KnowledgeSourcesReadService,
        private readonly workspaces: WorkspacesService,
        private readonly installations: InstallationRecordsService,
        private readonly versions: ContextVersionsService,
    ) {}

    /** Reads the applied setup, house voice, public knowledge and facts. */
    async material(workspaceId: string): Promise<BrandMaterial> {
        const [shop, authority, snapshot, sources, facts] = await Promise.all([
            this.workspaces.nameOf(workspaceId),
            this.authority.load({ workspaceId }),
            this.setupSnapshot(workspaceId),
            this.sources.allPublicTexts(workspaceId, "content", SOURCE_LIMIT),
            this.facts.forView(workspaceId, "customer", "content", null, 80),
        ])
        const evidence = (key: string): string => trimmedText(snapshot?.gates[key]?.evidence)
        return {
            shop,
            authority: {
                brandVoice: authority?.brand_voice ?? "",
                replyStyle: authority?.reply_style ?? "",
                limitsNote: authority?.limits_note ?? "",
            },
            setup: {
                summary: trimmedText(snapshot?.summary),
                facts: snapshot?.facts.map((fact) => fact.text) ?? [],
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

    /** The setup the owner applied to the content module (its active context version); none before the first apply. */
    private async setupSnapshot(workspaceId: string): Promise<VersionSnapshot | null> {
        const installation = await this.installations.firstOfModule(workspaceId, "content")
        if (installation?.activeContextVersionId == null) return null
        return (await this.versions.find(installation.activeContextVersionId))?.snapshot ?? null
    }
}
