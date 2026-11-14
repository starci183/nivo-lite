import { Injectable, Optional } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ToolRegistryService, type ToolCaller, type ToolJson } from "@modules/domain/tools"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { NodeRightsSwitchService } from "@modules/domain/tool-grants"
import { clipped } from "@modules/domain/native-tools/native-masking.policy"
import { scrubbed } from "@modules/domain/native-tools/native-scrub.policy"
import { PASSAGE_SEARCH_SCHEMA } from "@modules/domain/native-tools/passage-native.schema"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { isDomainError } from "@modules/platform/errors"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import type { InternalText } from "./public-documents.contracts"
import { PublicDocumentsLogEvent } from "./public-documents.log-events"

/** The tool that reads one internal document whole. */
export const READ_TOOL: typeof TOOL.brainDocumentRead = TOOL.brainDocumentRead

/**
 * The tool that searches the documents for a question: the passage search. `nivo.tool.brain.search` answers the truths in force only
 * (`facts`), never which document says what, so it cannot name the documents a proposal is drafted from.
 */
export const SEARCH_TOOL: typeof TOOL.brainPassageSearch = TOOL.brainPassageSearch

/** The longest query the passage tool takes (its own validator's bound): a longer question is cut, not refused by the gateway. */
const QUERY_CHARS = PASSAGE_SEARCH_SCHEMA.shape.query.maxLength ?? 300

/** The code of a refusal when the tool answered, but not in the shape it promises: read as a refusal, never as "nothing found". */
export const ANSWER_UNREADABLE = "answer_unreadable"

/** How many passages a search for a customer question asks for. */
const SEARCH_LIMIT = 6

/** How many distinct documents one search may lead to. */
const HIT_DOCUMENTS = 3

/** What one internal read gave. */
export type InternalDocumentReadOutcome =
    { readonly kind: "ok"; readonly text: InternalText } | { readonly kind: "no_right" } | { readonly kind: "refused" }

/**
 * What one internal search gave: the documents its passages came from, best first; or why nothing could be searched. `refused`
 * carries the code: the gateway's failure code (`unknown_tool`, `invalid_arguments`, `tool_error`, ...) or `answer_unreadable`.
 */
export type HitsOutcome =
    | { readonly kind: "ok"; readonly sourceIds: ReadonlyArray<string> }
    | { readonly kind: "no_right" }
    | { readonly kind: "refused"; readonly code: string }

/** What one gateway call gave. */
type AskOutcome =
    | { readonly kind: "ok"; readonly value: ToolJson }
    | { readonly kind: "no_right" }
    | { readonly kind: "refused"; readonly code: string }

/** The most characters of one document a person's read hands the draft: the bound the Brain's own document tool clips to. */
const DOCUMENT_CHARS = 12_000

const stringOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The text of a `nivo.tool.brain.document.read` answer, or null when it does not have the shape the tool promises. */
const textOf = (value: ToolJson, sourceId: string): InternalText | null => {
    const document = value.document
    if (!isRecord(document)) return null
    const title = stringOf(document.title)
    const text = stringOf(document.text)
    const contentHash = stringOf(document.contentHash)
    return title === null || text === null || contentHash === null ? null : { sourceId, title, contentHash, text }
}

/**
 * The distinct document ids (`doc`) of a `nivo.tool.brain.passage.search` answer, in the order of its hits, at most `HIT_DOCUMENTS`;
 * null when the answer has no `hits` list, the shape the tool promises (`searchAnswerOf`).
 */
const hitsOf = (value: ToolJson): ReadonlyArray<string> | null => {
    if (!Array.isArray(value.hits)) return null
    const ids = value.hits.flatMap((hit): ReadonlyArray<string> => {
        const id = isRecord(hit) ? stringOf(hit.doc) : null
        return id === null ? [] : [id]
    })
    return [...new Set(ids)].slice(0, HIT_DOCUMENTS)
}

@Injectable()
/**
 * How the public documents reach the internal ones: only through NIVO MCP, as an agent the owner granted the tool, with no customer
 * conversation in the call, so the gateway applies the grant, the view of the agent and the audit line of the call. An agent that
 * faces customers is refused `internal_only` by the tool itself, and the next granted agent is tried. With no right, nothing is read.
 *
 * Rights follow who asked. Once the workspace's switch "node rights decide" is ON, a read a member asked for (the owner's or a
 * manager's draft: the job carries who asked) is that PERSON's read, not a borrowed agent's: the member is proven at the time of the
 * read, the document must be an internal, fully read document of the workspace, its text is scrubbed and clipped as the Brain's tool
 * does, and one audit line names the member. A read no person asked for (a customer question's proposal: a search and its reads) has
 * no node either, so it keeps the agent-level rule exactly as before. With the switch OFF every read is as before.
 */
export class InternalReaderService {
    constructor(
        private readonly gateway: ToolRegistryService,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly sources: KnowledgeSourcesReadService,
        @Optional() private readonly nodeSwitch?: NodeRightsSwitchService,
    ) {}

    /**
     * One internal document whole, scrubbed and clipped, with the hash of its text. `requestedBy` is the Auth user of the member who
     * asked for the draft, or null when no person did.
     */
    async read(
        workspaceId: string,
        sourceId: string,
        requestedBy: string | null = null,
    ): Promise<InternalDocumentReadOutcome> {
        if (requestedBy !== null && (await this.nodeSwitch?.decides(workspaceId)) === true)
            return this.readAsPerson(workspaceId, sourceId, requestedBy)
        const asked = await this.ask(workspaceId, READ_TOOL, { sourceId })
        if (asked.kind !== "ok") return asked.kind === "no_right" ? asked : { kind: "refused" }
        const text = textOf(asked.value, sourceId)
        return text === null ? { kind: "refused" } : { kind: "ok", text }
    }

    /**
     * The documents whose passages the Brain finds for a customer question, as the granted agent sees them. A refused call or an
     * answer not of the tool's shape is `refused` with its code (logged), never an empty find: only a search that ran and found no
     * passage is `ok` with no document.
     */
    async hits(workspaceId: string, question: string): Promise<HitsOutcome> {
        const asked = await this.ask(workspaceId, SEARCH_TOOL, { query: question.slice(0, QUERY_CHARS), limit: SEARCH_LIMIT })
        if (asked.kind !== "ok") return asked
        const sourceIds = hitsOf(asked.value)
        if (sourceIds !== null) return { kind: "ok", sourceIds }
        this.logger.warn(PublicDocumentsLogEvent.ReadRefused, { tool: SEARCH_TOOL, code: ANSWER_UNREADABLE })
        return { kind: "refused", code: ANSWER_UNREADABLE }
    }

    /** Calls the tool as each agent granted it, until one answers; an agent the tool refuses as internal-only is passed over. */
    private async ask(workspaceId: string, tool: string, args: ToolJson): Promise<AskOutcome> {
        const agents = await this.gateway.agentsGranted(workspaceId, [tool])
        return this.askFrom(workspaceId, agents, tool, args)
    }

    /** Asks the first agent of the list; when the tool passes it over, asks the rest. */
    private async askFrom(
        workspaceId: string,
        agents: ReadonlyArray<string>,
        tool: string,
        args: ToolJson,
    ): Promise<AskOutcome> {
        const [agentId, ...rest] = agents
        if (agentId === undefined) return { kind: "no_right" }
        const caller: ToolCaller = {
            workspaceId,
            agentId,
            conversationId: null,
            workItemId: null,
            origin: "document_reader",
        }
        const result = await this.gateway.call(caller, tool, args)
        if (result.ok) return { kind: "ok", value: result.value }
        if (result.code === "internal_only" || result.code === "not_granted") {
            return this.askFrom(workspaceId, rest, tool, args)
        }
        this.logger.warn(PublicDocumentsLogEvent.ReadRefused, { tool, code: result.code })
        return { kind: "refused", code: result.code }
    }

    /**
     * A member's read of one internal document: the member proven now (any active member may view, the owner's rule for now), the
     * document internal, ready and hashed, its text scrubbed and clipped as the Brain's tool does, one audit line naming the member.
     * A person is no agent, so no agent's lane narrows what they read.
     */
    private async readAsPerson(
        workspaceId: string,
        sourceId: string,
        requestedBy: string,
    ): Promise<InternalDocumentReadOutcome> {
        const memberId = await this.memberOf(workspaceId, requestedBy)
        if (memberId === null) return { kind: "no_right" }
        const source = await this.sources.textOf(workspaceId, sourceId)
        const audit = { workspaceId, memberId, sourceId }
        if (source?.visibility !== "internal" || source.status !== "ready" || source.contentHash === null) {
            this.logger.info(PublicDocumentsLogEvent.PersonRead, { ...audit, outcome: "refused" })
            return { kind: "refused" }
        }
        this.logger.info(PublicDocumentsLogEvent.PersonRead, { ...audit, outcome: "ok" })
        return {
            kind: "ok",
            text: {
                sourceId,
                title: scrubbed(source.title),
                contentHash: source.contentHash,
                text: clipped(scrubbed(source.content), DOCUMENT_CHARS),
            },
        }
    }

    /** The seat id of the member who asked, or null when they are no longer an active member of the workspace (logged). */
    private async memberOf(workspaceId: string, requestedBy: string): Promise<string | null> {
        try {
            return await this.members.idOf(requestedBy, workspaceId)
        } catch (cause: unknown) {
            if (!isDomainError(cause)) throw cause
            this.logger.info(PublicDocumentsLogEvent.PersonRead, {
                workspaceId,
                outcome: "not_member",
                code: cause.code,
            })
            return null
        }
    }
}
