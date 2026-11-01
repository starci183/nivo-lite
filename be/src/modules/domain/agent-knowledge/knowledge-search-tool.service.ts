import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { KnowledgeCaller, KnowledgePassages, KnowledgeSearch } from "@modules/domain/agent-tools"
import { AgentDirectoryService } from "@modules/domain/agents"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import type { KnowledgeView } from "./agent-knowledge.contracts"
import { viewOf } from "./knowledge-view.policy"

/** The module a conversation answers in when its agent cannot be read. */
const DEFAULT_MODULE = "chatbot"
/** How many passages a tool search returns. */
const TOOL_LIMITS = { facts: 6, passages: 6, budget: 3000 }
/** The connector an audit line names for a read of NIVO's own knowledge. */
const CONNECTOR = "nivo"
/** The audit code of a read that failed. */
const READ_FAILED = "read_failed"

/** Who reads, through which view. */
interface Reader {
    /** The agent of the read, when known. */
    readonly agentId: string | null
    /** The view the read answers for. */
    readonly view: KnowledgeView
}

/** What one read audits: its name and its arguments, masked and hashed, never the customer's words. */
interface ReadLine {
    /** The tool. */
    readonly tool: string
    /** The masked arguments. */
    readonly masked: Readonly<Record<string, unknown>>
    /** The text the hash is taken of. */
    readonly hashed: string
    /** When the read started, in epoch milliseconds. */
    readonly started: number
}

/** How one read ended, as its audit line says. */
interface ReadResult {
    /** ok or error. */
    readonly outcome: string
    /** The audit code of a failure, or null. */
    readonly errorCode: string | null
    /** What came back, without its content. */
    readonly resultSummary: string
}

/** The answer of a read and the line that sums it up. */
interface Read<Answer> {
    /** What the agent gets. */
    readonly answer: Answer
    /** What the audit line says. */
    readonly summary: string
}

@Injectable()
/**
 * The reads an agent makes through NIVO MCP: `knowledge.search` and `memory.read`. A turn with a conversation reads the PUBLIC view of
 * the conversation's own agent and instance (the knowledge shared by every instance plus what is kept for that branch), never another
 * tenant's and never an internal document; a turn without one reads its own agent's view. Every read leaves a line in `mcp_call_log`,
 * written before the answer leaves: a read that cannot be audited is not answered.
 */
export class KnowledgeSearchToolService implements KnowledgeSearch {
    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly recall: KnowledgeRecallService,
        private readonly agents: AgentDirectoryService,
        private readonly callLog: McpCallLogService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The passages and citations for a query. */
    search(caller: KnowledgeCaller, query: string): Promise<KnowledgePassages> {
        const line = { masked: { query_chars: query.length }, hashed: query }
        return this.audited(caller, { ...line, tool: "knowledge.search" }, async (view) => {
            const found = await this.recall.recall(view, query, TOOL_LIMITS)
            return {
                answer: {
                    passages: found.brief,
                    citations: found.passages.map((passage) => ({ title: passage.title, topic: passage.topic ?? "" })),
                },
                summary: `${found.passages.length} passages, ${found.facts.length} facts`,
            }
        })
    }

    /** The standing memory of the shared brain (facts in force and approved lessons) through the caller's view. */
    memory(caller: KnowledgeCaller): Promise<string> {
        return this.audited(caller, { tool: "memory.read", masked: {}, hashed: "" }, async (view) => {
            const memory = await this.recall.standingMemory(view)
            return { answer: memory, summary: `${memory.length} chars` }
        })
    }

    private async audited<Answer>(
        caller: KnowledgeCaller,
        request: Omit<ReadLine, "started">,
        run: (view: KnowledgeView) => Promise<Read<Answer>>,
    ): Promise<Answer> {
        const reader = await this.readerOf(caller)
        const line = { ...request, started: this.clock.now().getTime() }
        const read = await run(reader.view).catch(async (cause: unknown) => {
            await this.log(caller, reader, line, { outcome: "error", errorCode: READ_FAILED, resultSummary: "" })
            throw cause
        })
        await this.log(caller, reader, line, { outcome: "ok", errorCode: null, resultSummary: read.summary })
        return read.answer
    }

    private async readerOf(caller: KnowledgeCaller): Promise<Reader> {
        const { workspaceId, conversationId, agentId } = caller
        if (conversationId === null) {
            const facts = agentId === null ? null : await this.agents.turnFactsOf(agentId)
            return {
                agentId,
                view: viewOf({ workspaceId, module: facts?.module ?? DEFAULT_MODULE, installationId: null }),
            }
        }
        const turn = await this.conversations.turnOf(conversationId)
        const own = turn.kind === "ok" && turn.value.workspaceId === workspaceId ? turn.value : null
        return {
            agentId: agentId ?? own?.agent.id ?? null,
            view: viewOf({
                workspaceId,
                module: own?.agent.module ?? DEFAULT_MODULE,
                audience: "customer",
                installationId: own?.installationId ?? null,
            }),
        }
    }

    private log(caller: KnowledgeCaller, reader: Reader, line: ReadLine, result: ReadResult): Promise<void> {
        return this.callLog.append({
            workspaceId: caller.workspaceId,
            connector: CONNECTOR,
            tool: line.tool,
            agentId: reader.agentId,
            conversationId: caller.conversationId,
            workItemId: null,
            argsMaskedJson: JSON.stringify(line.masked),
            argsHash: createHash("sha256").update(line.hashed).digest("hex"),
            ...result,
            durationMs: Math.max(0, this.clock.now().getTime() - line.started),
            approvedBy: null,
        })
    }
}
