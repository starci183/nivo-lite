import { Injectable } from "@nestjs/common"
import { BrainFactsReadService, factSlugOf, inForce, visibleTo } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import {
    BRAIN_FACTS_GET_INPUT_SCHEMA,
    BRAIN_FACTS_GET_SCHEMA,
    BRAIN_FACTS_LIST_INPUT_SCHEMA,
    BRAIN_FACTS_LIST_SCHEMA,
    BRAIN_SEARCH_INPUT_SCHEMA,
    BRAIN_SEARCH_SCHEMA,
} from "./brain-native.schema"
import { clipped } from "./native-masking.policy"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"
import { evidenceLinesOf, factLineOf, isServed } from "./native-view.policy"
import type { NativeView } from "./native-view.policy"
import { NativeViewService } from "./native-view.service"

/** How long the embedding of a question may take: the database half of the search then has room inside the gateway's limit. */
const EMBED_BUDGET_MS = 2500

/** The longest passage a tool answers, in characters. */
const PASSAGE_CHARS = 400

/** How many facts one read looks across in the view. */
const FACTS_WINDOW = 500

/** The most facts the word search ranks before the withheld subjects are left out. */
const SEARCH_WINDOW = 50

/** What `search` asks for. */
interface SearchInput {
    /** The question. */
    readonly query: string
    /** The most facts and passages. */
    readonly limit: number
}

/** The NIVO Brain native connector: what the business knows, read through the view of the calling agent. */
export const BRAIN_MANIFEST: NativeConnectorManifest = {
    key: "brain",
    name: "NIVO Brain",
    kind: "native",
    contractVersion: "brain-native@1",
    tools: [
        {
            name: "search",
            description:
                "Search the Brain of the business for a question: the facts in force that answer it and the passages of its documents.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: BRAIN_SEARCH_INPUT_SCHEMA,
            argumentSchema: BRAIN_SEARCH_SCHEMA,
            secretFields: ["query", "value", "content", "title"],
        },
        {
            name: "facts.list",
            description: "The facts in force of the business that this agent may read, optionally of one subject.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: BRAIN_FACTS_LIST_INPUT_SCHEMA,
            argumentSchema: BRAIN_FACTS_LIST_SCHEMA,
            secretFields: ["subject", "value"],
        },
        {
            name: "facts.get",
            description: "One fact in force of the business with the kind and label of its evidence and when it holds.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: BRAIN_FACTS_GET_INPUT_SCHEMA,
            argumentSchema: BRAIN_FACTS_GET_SCHEMA,
            secretFields: ["value", "label"],
        },
    ],
}

@Injectable()
/**
 * Runs the Brain tools for a workspace. Every read answers for one view, the same one `knowledge.search` uses: the workspace of the
 * gateway caller, the module and instance of the caller's agent, and an audience a conversation or a customer-facing module narrows
 * to the public. Facts about customers and people are never served and evidence leaves as kind and label only.
 */
export class BrainNativeService implements NativeAdapter {
    readonly manifest = BRAIN_MANIFEST

    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly views: NativeViewService,
        private readonly facts: BrainFactsReadService,
        private readonly knowledge: KnowledgeSearchService,
    ) {}

    /** Runs one Brain tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        if (tool === "search") return this.search(workspaceId, argumentsOf(tool, BRAIN_SEARCH_SCHEMA, args), caller)
        if (tool === "facts.list") {
            return this.list(workspaceId, argumentsOf(tool, BRAIN_FACTS_LIST_SCHEMA, args), caller)
        }
        if (tool === "facts.get") return this.get(workspaceId, argumentsOf(tool, BRAIN_FACTS_GET_SCHEMA, args), caller)
        throw unknownTool(tool)
    }

    /** The facts that match the question, and the passages of the business documents, concurrently. */
    private async search(workspaceId: string, input: SearchInput, caller: NativeCaller): Promise<GatewayJson> {
        const view = await this.views.of(workspaceId, caller)
        const [facts, passages] = await Promise.all([
            this.facts.search(
                view.workspaceId,
                view.audience,
                view.module,
                view.installationId,
                input.query,
                SEARCH_WINDOW,
            ),
            this.passagesOf(view, input),
        ])
        return {
            facts: facts.filter(isServed).slice(0, input.limit).map(factLineOf),
            passages: passages
                .filter((passage) => passage.layer === "business")
                .map((passage) => ({
                    sourceId: passage.sourceId,
                    title: passage.title,
                    topic: passage.topic,
                    order: passage.order ?? null,
                    content: clipped(passage.content, PASSAGE_CHARS),
                })),
        }
    }

    /** The passages for the question; a module outside the catalogue has no lane to search. Embedding gets its own budget. */
    private passagesOf(view: NativeView, input: SearchInput): Promise<ReadonlyArray<Passage>> {
        if (!view.searchable) return Promise.resolve([])
        return this.knowledge.forAgent({
            workspaceId: view.workspaceId,
            module: view.module,
            audience: view.audience,
            installationId: view.installationId,
            question: input.query,
            limit: input.limit,
            embedTimeoutMs: EMBED_BUDGET_MS,
        })
    }

    /** The facts in force of the view, newest change first, of one subject when asked. */
    private async list(
        workspaceId: string,
        input: { readonly subject?: string | undefined; readonly limit: number },
        caller: NativeCaller,
    ): Promise<GatewayJson> {
        const view = await this.views.of(workspaceId, caller)
        const inView = await this.facts.forView(
            view.workspaceId,
            view.audience,
            view.module,
            view.installationId,
            FACTS_WINDOW,
        )
        const subject = input.subject === undefined ? null : factSlugOf(input.subject)
        const served = inView.filter(
            (fact) => isServed(fact) && (subject === null || fact.subjectKey.includes(subject)),
        )
        return { facts: served.slice(0, input.limit).map(factLineOf) }
    }

    /** One fact, only while it is active, in force and inside the view. */
    private async get(workspaceId: string, input: { readonly id: string }, caller: NativeCaller): Promise<GatewayJson> {
        const view = await this.views.of(workspaceId, caller)
        const fact = await this.facts.get(view.workspaceId, input.id)
        if (fact === null || !this.readable(fact, view)) throw nativeRefusal("not_found")
        return {
            fact: {
                ...factLineOf(fact),
                evidence: evidenceLinesOf(fact.evidence),
                validFrom: fact.validFrom,
                validTo: fact.validTo,
            },
        }
    }

    private readable(fact: FactRecord, view: NativeView): boolean {
        return (
            fact.status === "active" &&
            isServed(fact) &&
            inForce(fact, this.clock.now().getTime()) &&
            visibleTo(fact, view.audience, view.module, view.installationId)
        )
    }
}
