import type { FactRecord } from "@modules/domain/brain-facts"
import type { Passage } from "@modules/domain/knowledge"
import type { HubNoteSource, KnowledgeSources } from "./gateway-turns.contracts"

/** No card lists more sources than the card contract keeps. */
const SOURCES_MAX = 10

/** A passage's source: the workspace's own documents are the Second Brain (layer 2), NIVO's seeded ones the base (layer 4). */
const sourceOfPassage = (passage: Passage): HubNoteSource => ({
    layer: passage.layer === "business" ? 2 : 4,
    kind: passage.layer === "business" ? "brain_document" : "base_document",
    ref: passage.sourceId ?? passage.id,
    label: passage.title,
})

/** A confirmed fact of the Second Brain (layer 2). */
const sourceOfFact = (fact: FactRecord): HubNoteSource => ({
    layer: 2,
    kind: "brain_fact",
    ref: fact.id,
    label: `${fact.subjectLabel} - ${fact.attributeLabel}`,
})

/**
 * The knowledge a turn's recall put in front of the agent, as card sources: the facts first, then each quoted document once, in
 * recall order, at most ten.
 */
export const recallSourcesOf = (
    facts: ReadonlyArray<FactRecord>,
    passages: ReadonlyArray<Passage>,
): KnowledgeSources => {
    const sources = new Map<string, HubNoteSource>()
    for (const source of [...facts.map(sourceOfFact), ...passages.map(sourceOfPassage)]) {
        const key = `${source.kind}:${source.ref}`
        if (!sources.has(key)) sources.set(key, source)
    }
    return [...sources.values()].slice(0, SOURCES_MAX)
}
