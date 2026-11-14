import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { HEADER_NAME, accountFactsOf, pinnedMetaOf } from "./openapi-account.policy"
import { canonicalJsonOf, readDocument } from "./openapi-document.policy"
import type {
    DocumentProblem,
    OpenApiToolDeclaration,
    PinnedDocument,
    PinnedEffect,
    PinnedMethod,
} from "./openapi-tools.contracts"

/** What a person pins on an API connection so that it serves tools. */
export interface PinDraft {
    /** The document, as JSON text, as fetched from the Swagger URL (or given by the CLI). */
    readonly documentText: string
    /** The CRM's provider key the connection serves (`crm.nivoweb`): the CRM id the shop picked, never read from the document. */
    readonly connector: string
    /** Where the document was fetched from (the shop's Swagger URL); empty when it was given as text. */
    readonly swaggerUrl: string
    /** The header parameter that carries the calling workspace's id. */
    readonly workspaceHeader: string
    /** True to let writes act for real; false keeps every write that can a dry run. */
    readonly live: boolean
    /** Who pins. */
    readonly pinnedBy: string
    /** When, ISO 8601. */
    readonly pinnedAt: string
}

/** How one declared tool stands against a document. */
export interface PinnedToolState {
    /** The full tool id. */
    readonly tool: string
    /** `ready`: it can be called; else why not. */
    readonly state: "ready" | "missing" | "unsupported" | "mode_mismatch"
    /** The unsupported features of its operation, by name. */
    readonly unsupported: ReadonlyArray<string>
    /** The HTTP method of its operation in the document, or null when the document has none. */
    readonly method: string | null
    /** The path of its operation in the document, or null when the document has none. */
    readonly path: string | null
    /** The effect its operation marks (`x-nivo-effect`), or null when it marks none or the document has no such operation. */
    readonly effect: PinnedEffect | null
}

/** One operation of a document that no installed plugin declares a tool for: its tool id and where the document serves it. */
export interface UndeclaredOperation {
    /** The tool id the operation would be served under. */
    readonly toolId: string
    /** The HTTP method. */
    readonly method: PinnedMethod
    /** The path. */
    readonly path: string
}

/**
 * Why a pin is refused as a whole: the document cannot be read for the CRM (`DocumentProblem`), `connector_taken` (another open account
 * of the workspace already serves that CRM id: one account per CRM, so an operation names one system) or `workspace_header_invalid`. An
 * operation whose name breaks the law or is shared is NOT a refusal: it is kept unsupported and listed, and nothing can call it.
 */
export type PinProblem = DocumentProblem | "connector_taken" | "workspace_header_invalid"

/** How the document opens one declared tool to a run that serves a customer. */
export interface PinnedToolAudience {
    /** The full tool id. */
    readonly tool: string
    /** True when the document opens its operation to a run that serves a customer. */
    readonly customerAudience: boolean
    /** The parameter that names which customer it reads, bound to the conversation's link, or null when it names none. */
    readonly customerParameter: string | null
}

/** The audience marks of each declared tool as the document carries them; a tool whose operation the document lacks is closed. */
export const toolAudiencesOf = (
    document: PinnedDocument,
    declarations: ReadonlyArray<OpenApiToolDeclaration>,
): ReadonlyArray<PinnedToolAudience> =>
    declarations.map((declaration): PinnedToolAudience => {
        const operation = document.operations.get(declaration.tool)
        return {
            tool: declaration.tool,
            customerAudience: operation?.customerAudience === true,
            customerParameter: operation?.customerParameter ?? null,
        }
    })

/** The operations of a document that no declared tool names, in document order: what the pin view lists by tool id. */
export const undeclaredOperationsOf = (
    document: PinnedDocument,
    declarations: ReadonlyArray<OpenApiToolDeclaration>,
): ReadonlyArray<UndeclaredOperation> => {
    const declared = new Set(declarations.map((declaration) => declaration.tool))
    return [...document.operations.values()]
        .filter((operation) => !declared.has(operation.toolId))
        .map((operation) => ({ toolId: operation.toolId, method: operation.method, path: operation.path }))
}

/** The public facts of the other open accounts of a provider, one record each. */
export type OtherAccountMetas = ReadonlyArray<Readonly<Record<string, string>>>

/**
 * True when one of the other open accounts of the workspace already serves the source: `others` are the public facts of every open
 * account of the provider except the one being pinned.
 */
export const connectorTakenBy = (connector: string, others: OtherAccountMetas): boolean =>
    others.some((meta) => accountFactsOf(meta)?.connector === connector)

/** A pin ready to store, or why it is refused. */
export type Pinning =
    | {
          readonly ok: true
          /** The CRM's provider key the account serves (`crm.nivoweb`). */
          readonly connector: string
          /** The public facts to merge into the connection. */
          readonly meta: Readonly<Record<string, string>>
          /** The pin: the sha256 of the canonical document. */
          readonly sha256: string
          /** How each declared tool of the source stands. */
          readonly tools: ReadonlyArray<PinnedToolState>
          /** How the document opens each declared tool of the source to a run that serves a customer. */
          readonly audiences: ReadonlyArray<PinnedToolAudience>
          /** The operations of the document no declared tool names, by tool id. */
          readonly undeclared: ReadonlyArray<UndeclaredOperation>
      }
    | { readonly ok: false; readonly problem: PinProblem }

/** How each declared tool stands against a document, looked up by its id in the document's id index: only a `ready` one can be called. */
export const toolStatesOf = (
    document: PinnedDocument,
    declarations: ReadonlyArray<OpenApiToolDeclaration>,
): ReadonlyArray<PinnedToolState> =>
    declarations.map((declaration): PinnedToolState => {
        const operation = document.operations.get(declaration.tool)
        if (operation === undefined) {
            return { tool: declaration.tool, state: "missing", unsupported: [], method: null, path: null, effect: null }
        }
        const place = {
            method: operation.method,
            path: operation.path,
            effect: operation.effect,
        }
        if (operation.unsupported.length > 0) {
            return { tool: declaration.tool, state: "unsupported", unsupported: operation.unsupported, ...place }
        }
        const mismatch = declaration.reads && operation.method !== "GET"
        return { tool: declaration.tool, state: mismatch ? "mode_mismatch" : "ready", unsupported: [], ...place }
    })

/**
 * The pin of a document on an account for the CRM `draft.connector` (`crm.nivoweb`): the document is read whole for that CRM (a document
 * the provider cannot read is refused), stored as its canonical JSON beside the sha256 of that text, the Swagger URL it came from and the
 * header its workspace id goes in: the connection's own snapshot, never shared with another. The CRM id need not be one an installed
 * package declares (a shop's own CRM is connectable under its own id; its operations serve the workbench and MCP). `tools` is the
 * compatibility of the pin with what the installed packages call on that CRM (`declarations`: `ready`, else why not). Nothing is called.
 */
export const pinOf = (draft: PinDraft, declarations: ReadonlyArray<OpenApiToolDeclaration>): Pinning => {
    if (!HEADER_NAME.test(draft.workspaceHeader)) return { ok: false, problem: "workspace_header_invalid" }
    const { connector } = draft
    const reading = readDocument(draft.documentText, connector)
    if (!reading.ok) return reading
    const { document } = reading
    const declared = declarations.filter((declaration) => declaration.connector === connector)
    const parsed = parseJsonText(draft.documentText)
    const canonical = canonicalJsonOf(parsed.ok && isRecord(parsed.value) ? parsed.value : {})
    return {
        ok: true,
        connector,
        sha256: document.sha256,
        meta: pinnedMetaOf(
            {
                connector,
                swaggerUrl: draft.swaggerUrl,
                workspaceHeader: draft.workspaceHeader,
                documentSha256: document.sha256,
                live: draft.live,
                pinnedBy: draft.pinnedBy,
                pinnedAt: draft.pinnedAt,
            },
            canonical,
        ),
        tools: toolStatesOf(document, declared),
        audiences: toolAudiencesOf(document, declared),
        undeclared: undeclaredOperationsOf(document, declared),
    }
}
