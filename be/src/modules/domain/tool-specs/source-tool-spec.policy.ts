import type { PinnedOperation } from "@modules/domain/openapi-tools"
import type { ToolDataKind, ToolSpec } from "./tool-specs.contracts"

/** What the spec of a source's operation is read from: the source the plugin declares and the operation of its pinned document. */
export interface SourceOperation {
    /** The source key the plugin declares (`crm`): the owner of every tool of the source. */
    readonly source: string
    /** The kind of data the source's reads reach (the plugin's declaration). */
    readonly dataKind: ToolDataKind
    /** The operation's HTTP method: every method but GET writes. */
    readonly method: PinnedOperation["method"]
    /** The effect the document marks (`x-nivo-effect`), or null when it marks none. */
    readonly effect: PinnedOperation["effect"]
}

/**
 * The spec of a tool a SOURCE generates (`nivo.tool.<source>.<method>.<path>`, or a purpose its document marks), from the pinned
 * document: a GET reads (every held account, the source's data kind); any other method writes (ONE account of the node's list). Its
 * money / irreversible mark is display only (nivo-frame `rights`). The owner is the source key. Its refusals are the provider's answers
 * to a call, free text: an open set.
 */
export const sourceToolSpecOf = (operation: SourceOperation): ToolSpec => {
    const reads = operation.method === "GET"
    return {
        mutates: !reads,
        owners: [operation.source],
        account: reads ? "each" : "any",
        dataKind: operation.dataKind,
        onceBy: [],
        refusals: { closed: false, codes: [] },
        // An operation of the source is no platform purpose: a purpose's slot is the core registry's.
        adapter: null,
        // It is read from the pinned document itself, so the account that pinned it serves it.
        availability: "bound",
    }
}
