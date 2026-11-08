import { Injectable } from "@nestjs/common"
import { AgentBindingsService, PURPOSES } from "@modules/domain/agent-connections"
import { AgentKnowledgeLensService } from "@modules/domain/agent-knowledge"
import { AgentDirectoryService } from "@modules/domain/agents"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import {
    GAPS_SHOWN,
    regionKey,
    toneOfStatus,
    type ConnectionsRegion,
    type KnowledgeRegion,
} from "./platform-regions.policy"

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
            })),
        }
    }

    /** What the agent of the workspace knows, counted by visibility, with its most asked open gaps. */
    async knowledgeOf(workspaceId: string, agentId: string, locale: Locale): Promise<KnowledgeRegion> {
        const say = (key: string, count?: number): string =>
            this.catalog.get(key, count === undefined ? {} : { count }, locale)
        const agent = await this.directory.find(workspaceId, agentId)
        const module = agent?.module ?? ""
        const [counts, open] = await Promise.all([
            this.lens.countsFor(workspaceId, module, null),
            this.gaps.openOfModule(workspaceId, module, GAPS_SHOWN),
        ])
        return {
            openLabel: say(regionKey("knowledge", "open")),
            openHref: "",
            footer: say(regionKey("knowledge", "footer")),
            publicTitle: say(regionKey("knowledge", "public")),
            publicDescription: say(regionKey("knowledge", "documents"), counts.documents.public),
            internalTitle: say(regionKey("knowledge", "internal")),
            internalDescription: say(regionKey("knowledge", "documents"), counts.documents.internal),
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
