import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { TOOL_MANIFEST } from "@modules/domain/agent-tools"
import { agentIdFor } from "@modules/integrations/openclaw"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    agentsMdOf,
    appliedContextOf,
    budgetRules,
    knowledgeFileOf,
    soulMdOf,
    toolsSectionOf,
} from "./agent-bundle.policy"
import type { AgentBundle, OptionalAgentPersona, TextOf } from "./agents.contracts"
import { InjectInstallations, InjectKnowledge, InjectModuleProfiles } from "./agents.decorators"
import { AgentsLogEvent } from "./agents.log-events"
import { personaOf } from "./agents.mapper"
import type { Installation, InstallationDirectory, KnowledgeLens, ModuleProfiles } from "./agents.port"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

/** The language the files of an agent workspace are written in. */
const BUNDLE_LOCALE: Locale = "vi"

/** How many knowledge sources a bundle may carry. */
const SOURCE_LIMIT = 200

@Injectable()
/**
 * The OpenClaw copy of one agent, built only from Supabase (the source of truth) and written one way by the sync. AGENTS.md holds the
 * NIVO base rules, the active context version, the persona, the knowledge and the reply contract; SOUL.md the tone; knowledge/*.md the
 * business documents the lens lets this agent read (a customer-facing module gets public sources only).
 */
export class AgentBundleService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectModuleProfiles() private readonly modules: ModuleProfiles,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @Optional() @InjectKnowledge() private readonly knowledge: KnowledgeLens | null = null,
    ) {}

    /** Builds the files of an installation's agent; a module that has no definition is refused. */
    async build(installation: Installation): Promise<AgentBundle> {
        const folder = this.modules.knowledgeFolderOf(installation.module)
        if (folder === null) {
            throw new AgentsError({ code: AgentsErrorCode.InstallationNotFound, params: { id: installation.id } })
        }
        const lens = this.lens()
        const { workspaceId, module } = installation
        const t: TextOf = (key, params = {}) => this.catalog.get(key, params, BUNDLE_LOCALE)
        const [persona, version, base, sources, memory] = await Promise.all([
            this.personaOf(workspaceId, installation.agentId),
            installation.activeContextVersionId === null
                ? Promise.resolve(null)
                : this.installations.contextVersionOf(installation.activeContextVersionId),
            lens.baseRulesOf([folder, "core"]),
            lens.sourcesFor(workspaceId, module, installation.id, SOURCE_LIMIT),
            this.memoryOf(lens, installation),
        ])
        const name = persona?.name ?? t("bundle.defaultAgentName", { module })
        const audience = lens.audienceOf(module)
        const baseContract = t("bundle.replyContract", {
            applicationClause: this.modules.applicationClause(),
            applicationShape: this.modules.applicationShape(),
        })
        const agentsMd = agentsMdOf(
            {
                name,
                module,
                audience,
                persona,
                rules: budgetRules(base.filter((rule) => rule.kind === "authority" || rule.kind === "escalation")),
                version: appliedContextOf(version, t),
                memory,
                sources,
                contract: this.modules.replyContractOf(module, baseContract),
                tools: toolsSectionOf(TOOL_MANIFEST, t),
            },
            t,
        )
        const soulMd = soulMdOf(
            name,
            version?.toneEvidence ?? "",
            base.filter((rule) => rule.kind === "tone"),
            t,
        )
        return {
            installationId: installation.id,
            workspaceId,
            module,
            agentId: agentIdFor(workspaceId, module),
            agentName: name,
            contextVersion: version?.version ?? null,
            audience,
            files: [
                { path: "AGENTS.md", content: agentsMd },
                { path: "SOUL.md", content: soulMd },
                ...sources.map((source, index) => knowledgeFileOf(index, source, t)),
            ],
        }
    }

    /** The knowledge lens the full mode binds; the setup mode binds none, so a bundle cannot be built there. */
    private lens(): KnowledgeLens {
        if (this.knowledge === null) throw new AgentsError({ code: AgentsErrorCode.KnowledgeUnbound })
        return this.knowledge
    }

    private async personaOf(workspaceId: string, agentId: string | null): Promise<OptionalAgentPersona> {
        if (agentId === null) return null
        const row = await this.entityManager.findOne(AgentEntity, { where: { id: agentId, workspaceId } })
        return row === null ? null : personaOf(row)
    }

    /** The shared brain must never stop a sync: when it cannot be read the bundle goes without it. */
    private memoryOf(lens: KnowledgeLens, installation: Installation): Promise<string> {
        return lens
            .memoryFor(installation.workspaceId, installation.module, installation.id)
            .catch((cause: unknown) => {
                this.logger.error(AgentsLogEvent.MemoryUnavailable, cause, { installationId: installation.id })
                return ""
            })
    }
}
