import { Injectable } from "@nestjs/common"
import { PassageRetrievalService } from "@modules/domain/knowledge"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { nativeRefusal } from "./native-refusal.policy"
import type { NativeView } from "./native-view.policy"
import { NativeViewService } from "./native-view.service"
import { PASSAGE_NOTICE, readAnswerOf, searchAnswerOf } from "./passage-native.policy"
import {
    PASSAGE_READ_INPUT_SCHEMA,
    PASSAGE_READ_SCHEMA,
    PASSAGE_SEARCH_INPUT_SCHEMA,
    PASSAGE_SEARCH_SCHEMA,
    type PassageReadInput,
    type PassageSearchInput,
} from "./passage-native.schema"

/** The row key of the connector of the document reads; its public prefix is the Brain's (`nivo.tool.brain.passage.*`). */
export const PASSAGE_CONNECTOR = "brain-passages"

/** How long the embedding of a query may take: the two statements then have room inside the gateway's limit. */
const EMBED_BUDGET_MS = 2500

/**
 * The document reads of the second brain: find passages, then read them. Two small tools an agent calls as often as it needs in one
 * turn (search, read a hit with its neighbours, search again with other words), instead of one fixed list pushed into its prompt.
 */
export const PASSAGE_MANIFEST: ToolManifest = {
    key: PASSAGE_CONNECTOR,
    namespace: "nivo.tool.brain",
    name: "NIVO Brain documents",
    contractVersion: "brain-passages@1",
    tools: [
        {
            name: "passage.search",
            description:
                `Search the documents of the business for passages. \`query\`: the KEY WORDS of what you look for, not a whole question: a few words, an exact code, name or number as a document would write it (35.000, SP-0123; "phi giao noi thanh", not "ship bao nhieu vay shop"); passages holding more of the words rank higher (a code or number counts most), "quotes" keep an exact phrase that must appear, -word excludes; with or without Vietnamese diacritics. mode auto also finds passages of the same meaning (one embedding call); mode words is free and matches the words only. Each hit: id, doc, title, at (position in the document), updated (the day the document last changed), by (words | meaning | both), a snippet. Read a hit with ${TOOL.brainPassageRead} before you rely on it; no hit or a weak one: search again with the words the document itself would use, or fewer words; next = more of the same search.`,
            scope: "read",
            defaultMode: "auto",
            inputSchema: PASSAGE_SEARCH_INPUT_SCHEMA,
            argumentSchema: PASSAGE_SEARCH_SCHEMA,
            secretFields: ["notice", "query", "title", "snippet"],
            taints: true,
        },
        {
            name: "passage.read",
            description:
                "Read passages of one document in order: `id` = a passage with `before` / `after` neighbours (0 to 5 each), or `doc` + `at` = from a position of a document. prev / next are the positions to go on from (doc + at) to page through a long document; null = the start or the end.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: PASSAGE_READ_INPUT_SCHEMA,
            argumentSchema: PASSAGE_READ_SCHEMA,
            secretFields: ["notice", "title", "text"],
            taints: true,
        },
    ],
}

/** The lens of a view: the same four members, nothing a call could add to. */
const lensOf = (view: NativeView): Pick<NativeView, "workspaceId" | "module" | "audience" | "installationId"> => ({
    workspaceId: view.workspaceId,
    module: view.module,
    audience: view.audience,
    installationId: view.installationId,
})

@Injectable()
/**
 * Runs the document reads for a workspace. Every read answers for ONE view, the same one the fact tools use: the workspace of the
 * gateway caller, the module and instance of the caller's agent, and an audience a conversation or a customer-facing module narrows
 * to the public. The view is handed to the retrieval as its lens and is enforced in every statement: a customer-facing agent only
 * ever receives public passages the trust gate released, and a document it is served nothing of does not exist for it (no title, no
 * count, no snippet). A passage is answered as what a document says, never as a truth: no answer here has `facts` or a version.
 */
export class PassageNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = PASSAGE_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly retrieval: PassageRetrievalService,
    ) {}

    /** Runs one document read. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        if (tool === "passage.search") {
            return this.search(workspaceId, argumentsOf(tool, PASSAGE_SEARCH_SCHEMA, args), caller)
        }
        if (tool === "passage.read") return this.read(workspaceId, argumentsOf(tool, PASSAGE_READ_SCHEMA, args), caller)
        throw unknownTool(tool)
    }

    /** One page of ranked hits for the query, through the caller's view; a module outside the catalogue has no lane to search. */
    private async search(workspaceId: string, input: PassageSearchInput, caller: NativeCaller): Promise<ToolJson> {
        const view = await this.views.of(workspaceId, caller)
        if (!view.searchable) return { notice: PASSAGE_NOTICE, legs: [], hits: [], next: null }
        const found = await this.retrieval.search(lensOf(view), {
            query: input.query,
            mode: input.mode,
            limit: input.limit,
            after: input.after,
            embedTimeoutMs: EMBED_BUDGET_MS,
        })
        return searchAnswerOf(found, input.query, view.audience === "internal")
    }

    /** A stretch of one document through the caller's view; what the view holds nothing of is `not_found`, whatever the reason. */
    private async read(workspaceId: string, input: PassageReadInput, caller: NativeCaller): Promise<ToolJson> {
        const view = await this.views.of(workspaceId, caller)
        const read = view.searchable
            ? await this.retrieval.read(lensOf(view), {
                  ...(input.id === undefined ? {} : { passageId: input.id }),
                  ...(input.doc === undefined ? {} : { sourceId: input.doc }),
                  ...(input.at === undefined ? {} : { at: input.at }),
                  before: input.before,
                  after: input.after,
              })
            : null
        if (read === null) throw nativeRefusal("not_found")
        return readAnswerOf(read, view.audience === "internal")
    }
}
