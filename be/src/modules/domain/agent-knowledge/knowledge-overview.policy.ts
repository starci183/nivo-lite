import type { KnowledgeDocumentOverview, KnowledgeLayer, KnowledgeLayerOverview, LensLanes, OwnFactOverview } from "@modules/domain/agents"
import type { FactRecord, Scope } from "@modules/domain/brain-facts"
import type { ReadableSummary } from "@modules/domain/knowledge-sources"

/** The layers in the order a person reads them. */
const LAYERS: ReadonlyArray<KnowledgeLayer> = ["public", "internal", "restricted"]

/** The most facts kept for this agent alone that the tab lists. */
const OWN_FACT_LIMIT = 20

/** The scope a fact has, as the layer it belongs to. */
const layerOfScope = (scope: Scope): KnowledgeLayer => scope

/** Whether the view reads the documents of a layer: restricted facts live in no document. */
const readsDocuments = (layer: KnowledgeLayer, lanes: LensLanes): boolean =>
    layer === "public" ? lanes.documentPublic : layer === "internal" && lanes.documentInternal

/** Whether the view reads the facts of a layer. */
const readsFacts = (layer: KnowledgeLayer, lanes: LensLanes): boolean => {
    if (layer === "public") return lanes.factPublic
    return layer === "internal" ? lanes.factInternal : lanes.factRestricted
}

/** The documents a fact cites as evidence. */
const sourcesOf = (fact: FactRecord): ReadonlyArray<string> =>
    fact.evidence.flatMap((one) => (one.kind === "document" ? [one.ref] : []))

/** Whether the owner approved the fact. */
const isApproved = (fact: FactRecord): boolean => fact.status === "active"

/** The layers with how many documents and facts each holds for the agent, and whether the agent reads each. */
export const layersOf = (
    documents: ReadonlyArray<ReadableSummary>,
    facts: ReadonlyArray<FactRecord>,
    lanes: LensLanes,
): ReadonlyArray<KnowledgeLayerOverview> =>
    LAYERS.map((layer) => {
        const inLayer = facts.filter((fact) => layerOfScope(fact.scope) === layer)
        return {
            layer,
            isRead: readsFacts(layer, lanes) || readsDocuments(layer, lanes),
            documents: documents.filter((one) => one.visibility === layer).length,
            approvedFacts: inLayer.filter((item) => isApproved(item)).length,
            totalFacts: inLayer.length,
        }
    })

/** The documents of the agent with the facts read from each, newest change first. */
export const documentsOf = (
    documents: ReadonlyArray<ReadableSummary>,
    facts: ReadonlyArray<FactRecord>,
    lanes: LensLanes,
): ReadonlyArray<KnowledgeDocumentOverview> =>
    documents.map((one) => {
        const cited = facts.filter((fact) => sourcesOf(fact).includes(one.id))
        return {
            id: one.id,
            title: one.title,
            kind: one.kind,
            layer: one.visibility,
            updatedAt: one.updatedAt,
            isRead: readsDocuments(one.visibility, lanes),
            approvedFacts: cited.filter((item) => isApproved(item)).length,
            waitingFacts: cited.filter((fact) => !isApproved(fact)).length,
        }
    })

/** The facts only this agent reads, approved first. */
export const ownFactsOf = (facts: ReadonlyArray<FactRecord>): ReadonlyArray<OwnFactOverview> =>
    facts
        .filter((fact) => fact.scope === "restricted")
        .sort((a, b) => Number(isApproved(b)) - Number(isApproved(a)))
        .slice(0, OWN_FACT_LIMIT)
        .map((fact) => ({
            id: fact.id,
            label: `${fact.subjectLabel} · ${fact.attributeLabel}`,
            value: fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`,
            isApproved: isApproved(fact),
        }))

/** How many facts wait for the owner among those the agent would read once approved. */
export const waitingOf = (facts: ReadonlyArray<FactRecord>, lanes: LensLanes): number =>
    facts.filter((fact) => !isApproved(fact) && readsFacts(layerOfScope(fact.scope), lanes)).length
