import { Injectable } from "@nestjs/common"
import { AgentBindingsService, PURPOSES } from "@modules/domain/agent-connections"
import { AgentKnowledgeLensService } from "@modules/domain/agent-knowledge"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { GAPS_SHOWN, regionKey, toneOfStatus } from "./platform-regions.policy"
import type { ConnectionsRegion, KnowledgeRegion } from "./platform-regions.policy"

@Injectable()
/**
 * The data behind the connections and knowledge regions of an agent page: the connections bound to the agent, and what the agent knows with
 * its open gaps. It only reads the capabilities that own the data and says the result in the viewer's language; the words come from the
 * message catalog.
 */
export class PlatformRegionsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly bindings: AgentBindingsService,
        private readonly directory: AgentDirectoryService,
        private readonly gaps: KnowledgeGapsService,
        private readonly lens: AgentKnowledgeLensService,
        private readonly grants: ConnectionGrantsService,
    ) {}

    /** The connections bound to the agent, one row each, with the state and the access in words. */
    async connectionsOf(agentId: string, locale: Locale): Promise<ConnectionsRegion> {
        const say = (key: string): string => this.catalog.get(key, {}, locale)
        const connections = await this.bindings.connectionsFor(agentId, PURPOSES)
        return {
            manageLabel: say(regionKey("connections", "manage")),
            manageHref: "",
            rows: connections.map((connection) => ({
                id: connection.id,
                name: connection.name,
                description: say(regionKey("purpose", connection.purpose)),
                statusLabel: say(regionKey("status", connection.status)),
                statusTone: toneOfStatus(connection.status),
                accessLabel: say(regionKey("access", connection.access)),
                provider: connection.provider,
                access: connection.access,
                ...(connection.accountMasked === null ? {} : { accountMasked: connection.accountMasked }),
                isGranted: true,
            })),
        }
    }

    /**
     * The connections bound to the agent, then the accounts of the same kinds the agent is not granted yet, each with the command that
     * grants it. A connection the agent already uses for any purpose is not offered again.
     */
    async connectionsWithCandidatesOf(workspaceId: string, agentId: string, locale: Locale): Promise<ConnectionsRegion> {
        const say = (key: string): string => this.catalog.get(key, {}, locale)
        const [bound, directory] = await Promise.all([
            this.connectionsOf(agentId, locale),
            this.directory.find(workspaceId, agentId),
        ])
        const granted = new Set(bound.rows.map((row) => row.id))
        const candidates = await this.grants.candidatesOf(workspaceId, agentId, directory?.module ?? "")
        const open = candidates.filter((candidate) => candidate.access === null && !granted.has(candidate.id))
        return {
            ...bound,
            rows: [
                ...bound.rows,
                ...open.map((candidate) => ({
                    id: candidate.id,
                    name: candidate.name,
                    description: say(regionKey("purpose", candidate.purpose)),
                    statusLabel: say(regionKey("status", candidate.status)),
                    statusTone: toneOfStatus(candidate.status),
                    accessLabel: "",
                    provider: candidate.provider,
                    ...(candidate.accountMasked === null ? {} : { accountMasked: candidate.accountMasked }),
                    isGranted: false,
                    actionLabel: say(regionKey("connections", "grant")),
                })),
            ],
        }
    }

    /** What the agent of the workspace knows, counted by visibility, with its most asked open gaps. */
    async knowledgeOf(workspaceId: string, agentId: string, locale: Locale): Promise<KnowledgeRegion> {
        const say = (key: string, count?: number): string =>
            this.catalog.get(key, count === undefined ? {} : { count }, locale)
        const agent = await this.directory.find(workspaceId, agentId)
        const module = agent?.module ?? ""
        const [counts, open, overview, waiting] = await Promise.all([
            this.lens.countsFor(workspaceId, module, null),
            this.gaps.openOfModule(workspaceId, module, GAPS_SHOWN),
            this.lens.overviewFor(workspaceId, module, null),
            this.lens.waitingFactLabel(workspaceId, module, null),
        ])
        const approved = overview.layers.reduce((sum, layer) => sum + layer.approvedFacts, 0)
        const total = overview.layers.reduce((sum, layer) => sum + layer.totalFacts, 0)
        const publicDocuments = overview.layers.find((layer) => layer.layer === "public")?.documents ?? 0
        return {
            openLabel: say(regionKey("knowledge", "open")),
            openHref: "",
            footer: say(regionKey("knowledge", "footer")),
            publicTitle: say(regionKey("knowledge", "public")),
            publicDescription: say(regionKey("knowledge", "documents"), counts.documents.public),
            internalTitle: say(regionKey("knowledge", "internal")),
            internalDescription: say(regionKey("knowledge", "documents"), counts.documents.internal),
            summary: {
                documentsLine: this.catalog.get(
                    regionKey("knowledge", "documents_line"),
                    { documents: overview.documents.length, public: publicDocuments },
                    locale,
                ),
                factsLine: this.catalog.get(regionKey("knowledge", "facts_line"), { approved, total }, locale),
                approvedFacts: approved,
                totalFacts: total,
                blocker: waiting,
                blockerLine:
                    waiting === null
                        ? null
                        : this.catalog.get(regionKey("knowledge", "blocker"), { fact: waiting }, locale),
            },
            gaps:
                open.openCount === 0
                    ? null
                    : {
                          label: say(regionKey("knowledge", "gaps")),
                          count: String(open.openCount),
                          openLabel: say(regionKey("knowledge", "gaps_all")),
                          openHref: "",
                          rows: open.items.map((gap) => ({
                              id: gap.id,
                              title: gap.question,
                              description: gap.topic ?? "",
                              asked: say(regionKey("knowledge", "asked"), gap.count),
                          })),
                      },
        }
    }
}
