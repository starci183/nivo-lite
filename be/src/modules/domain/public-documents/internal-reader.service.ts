import { Injectable } from "@nestjs/common"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCaller, GatewayJson } from "@modules/domain/mcp-gateway"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import type { InternalText } from "./public-documents.contracts"
import { PublicDocumentsLogEvent } from "./public-documents.log-events"

/** The tool that reads one internal document whole. */
export const READ_TOOL = "nivo.brain.document.read"

/** The tool that searches the Brain for a question. */
export const SEARCH_TOOL = "nivo.brain.search"

/** How many passages a search for a customer question asks for. */
const SEARCH_LIMIT = 6

/** How many distinct documents one search may lead to. */
const HIT_DOCUMENTS = 3

/** What one internal read gave. */
export type InternalDocumentReadOutcome =
    { readonly kind: "ok"; readonly text: InternalText } | { readonly kind: "no_right" } | { readonly kind: "refused" }

/** What one internal search gave: the documents its passages came from, best first. */
export type HitsOutcome =
    | { readonly kind: "ok"; readonly sourceIds: ReadonlyArray<string> }
    | { readonly kind: "no_right" }
    | { readonly kind: "refused" }

/** What one gateway call gave. */
type AskOutcome =
    { readonly kind: "ok"; readonly value: GatewayJson } | { readonly kind: "no_right" } | { readonly kind: "refused" }

const stringOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The text of a `nivo.brain.document.read` answer, or null when it does not have the shape the tool promises. */
const textOf = (value: GatewayJson, sourceId: string): InternalText | null => {
    const document = value.document
    if (!isRecord(document)) return null
    const title = stringOf(document.title)
    const text = stringOf(document.text)
    const contentHash = stringOf(document.contentHash)
    return title === null || text === null || contentHash === null ? null : { sourceId, title, contentHash, text }
}

/** The distinct document ids of a `nivo.brain.search` answer, in the order of its passages, at most `HIT_DOCUMENTS`. */
const hitsOf = (value: GatewayJson): ReadonlyArray<string> => {
    const passages = Array.isArray(value.passages) ? value.passages : []
    const ids = passages.flatMap((passage): ReadonlyArray<string> => {
        const id = isRecord(passage) ? stringOf(passage.sourceId) : null
        return id === null ? [] : [id]
    })
    return [...new Set(ids)].slice(0, HIT_DOCUMENTS)
}

@Injectable()
/**
 * How the public documents reach the internal ones: only through NIVO MCP, as an agent the owner granted the tool, with no customer
 * conversation in the call, so the gateway applies the grant, the view of the agent and the audit line of the call. An agent that
 * faces customers is refused `internal_only` by the tool itself, and the next granted agent is tried. With no right, nothing is read.
 */
export class InternalReaderService {
    constructor(
        private readonly gateway: McpGatewayService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** One internal document whole, scrubbed and clipped by the tool, with the hash of its text. */
    async read(workspaceId: string, sourceId: string): Promise<InternalDocumentReadOutcome> {
        const asked = await this.ask(workspaceId, READ_TOOL, { sourceId })
        if (asked.kind !== "ok") return asked
        const text = textOf(asked.value, sourceId)
        return text === null ? { kind: "refused" } : { kind: "ok", text }
    }

    /** The documents the Brain finds for a customer question, as an internal agent sees them. */
    async hits(workspaceId: string, question: string): Promise<HitsOutcome> {
        const asked = await this.ask(workspaceId, SEARCH_TOOL, { query: question.slice(0, 500), limit: SEARCH_LIMIT })
        return asked.kind === "ok" ? { kind: "ok", sourceIds: hitsOf(asked.value) } : asked
    }

    /** Calls the tool as each agent granted it, until one answers; an agent the tool refuses as internal-only is passed over. */
    private async ask(workspaceId: string, tool: string, args: GatewayJson): Promise<AskOutcome> {
        const agents = await this.gateway.agentsGranted(workspaceId, [tool])
        return this.askFrom(workspaceId, agents, tool, args)
    }

    /** Asks the first agent of the list; when the tool passes it over, asks the rest. */
    private async askFrom(
        workspaceId: string,
        agents: ReadonlyArray<string>,
        tool: string,
        args: GatewayJson,
    ): Promise<AskOutcome> {
        const [agentId, ...rest] = agents
        if (agentId === undefined) return { kind: "no_right" }
        const caller: GatewayCaller = { workspaceId, agentId, conversationId: null, workItemId: null }
        const result = await this.gateway.call(caller, tool, args)
        if (result.ok) return { kind: "ok", value: result.value }
        if (result.code === "internal_only" || result.code === "not_granted") {
            return this.askFrom(workspaceId, rest, tool, args)
        }
        this.logger.warn(PublicDocumentsLogEvent.ReadRefused, { tool, code: result.code })
        return { kind: "refused" }
    }
}
