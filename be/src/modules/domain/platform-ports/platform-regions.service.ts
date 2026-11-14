import { Injectable } from "@nestjs/common"
import { AgentBindingsService, PURPOSES } from "@modules/domain/agent-connections"
import { AgentKnowledgeLensService } from "@modules/domain/agent-knowledge"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentAccountsService } from "@modules/domain/tools"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import {
    ABILITY_SEPARATOR,
    ATTACHED_ACCESS,
    GAPS_SHOWN,
    pick,
    regionKey,
    type ConnectionsRegion,
    type KnowledgeRegion,
} from "./platform-regions.policy"

@Injectable()
/**
 * The data behind the connections and knowledge regions of an agent page: the providers attached to the agent, and what the agent knows with
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
        private readonly accounts: AgentAccountsService,
    ) {}

    /**
     * The accounts attached to the agent, read only, one row per attachment: "provider · account", and the groups of tools its provider
     * serves (their own labels: an attached account reaches them all; the mode of a call is its node's). A provider that serves no tool
     * says it holds none. The masked account of a bank feed rides along for the readers that match a bank payment to it. The link
     * goes to the agent's rights, where all of it changes.
     */
    async connectionsOf(workspaceId: string, agentId: string, locale: Locale): Promise<ConnectionsRegion> {
        const say = (key: string): string => this.catalog.get(key, {}, locale)
        const [board, bound] = await Promise.all([
            this.accounts.board(workspaceId),
            this.bindings.connectionsFor(agentId, PURPOSES),
        ])
        const maskedOf = new Map(
            bound.flatMap((connection) =>
                connection.accountMasked === null ? [] : [[connection.id, connection.accountMasked] as const],
            ),
        )
        const rows = board.attachments
            .filter((attachment) => attachment.agentId === agentId)
            .flatMap((attachment) => {
                const provider = board.providers.find((one) => one.provider === attachment.provider)
                const account = provider?.accounts.find((one) => one.connectionId === attachment.connectionId)
                if (provider === undefined || account === undefined) return []
                const words = provider.abilities.map((ability) => pick(ability.label, locale))
                const masked = maskedOf.get(account.connectionId)
                return [
                    {
                        id: account.connectionId,
                        name: `${pick(provider.label, locale)}${ABILITY_SEPARATOR}${account.label}`,
                        description: words.length === 0 ? say(regionKey("connections", "none")) : words.join(ABILITY_SEPARATOR),
                        provider: provider.provider,
                        account: account.label,
                        access: ATTACHED_ACCESS,
                        ...(masked === undefined ? {} : { accountMasked: masked }),
                    },
                ]
            })
        return {
            label: say(regionKey("connections", "title")),
            rightsLabel: say(regionKey("connections", "rights")),
            rightsHref: "",
            rows,
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
