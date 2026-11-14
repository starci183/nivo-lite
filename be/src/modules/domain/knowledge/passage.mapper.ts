import type { SourceBrief } from "@modules/domain/knowledge-sources"
import type { NivoHit } from "@modules/domain/nivo-knowledge"
import type { Passage } from "./knowledge.contracts"
import type { PassageFound } from "./passage-retrieval.contracts"

/**
 * The mark an internal reader (an internal agent, "try asking", `nivo.tool.brain.search` passages) reads before a passage the shop-document critic
 * has not released to customers yet (trust gate, BG3). A customer search never returns such a passage.
 */
export const UNREVIEWED_MARK = "[chua soat]"

/** A passage of a business document, from the hit the passage search answers and the brief of its source. */
export const businessPassage = (hit: PassageFound, source: SourceBrief): Passage => ({
    layer: "business",
    id: hit.id,
    sourceId: hit.sourceId,
    module: hit.module,
    kind: source.kind,
    title: source.title,
    content: hit.customerReady ? hit.content : `${UNREVIEWED_MARK} ${hit.content}`,
    unreviewed: !hit.customerReady,
    score: hit.score,
    visibility: hit.visibility,
    topic: source.topic,
    order: hit.order,
})

/** A passage of the base knowledge of NIVO, from the hit the item search answers. */
export const nivoPassage = (hit: NivoHit): Passage => ({
    layer: "nivo",
    id: hit.id,
    sourceId: null,
    module: hit.module,
    kind: hit.kind,
    title: hit.title,
    content: hit.content,
    score: hit.score,
    visibility: "internal",
    topic: null,
    order: null,
})

/** The best `limit` passages of both layers, highest score first (business first on a tie), at least one and at most forty. */
export const rankPassages = (
    business: ReadonlyArray<Passage>,
    base: ReadonlyArray<NivoHit>,
    limit: number,
): ReadonlyArray<Passage> =>
    [...business, ...base.map((hit) => nivoPassage(hit))].sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(limit, 40)))

/** The tsquery text of the folded words of a question (`a | b`), or null when it has none. */
export const tsqueryOf = (folded: string): string | null => {
    const words = folded.replaceAll(/[^a-z0-9]+/g, " ").trim()
    return words === "" ? null : words.replaceAll(/\s+/g, ' | ')
}
