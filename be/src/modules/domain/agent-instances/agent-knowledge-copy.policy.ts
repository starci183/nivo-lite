import type { FactInput, FactRecord } from "@modules/domain/brain-facts"
import type { AddSourceInput, InstanceDocument } from "@modules/domain/knowledge-sources"

/** The longest a tag is stored (the document tags are cut at forty characters). */
const TAG_PREFIX = "copy:"

/** The tag that says a document was copied from another one: the id without hyphens, so it fits the tag limit. */
export const copyTagOf = (sourceId: string): string => `${TAG_PREFIX}${sourceId.replaceAll("-", "")}`

/** The provenance a copied fact carries beside the evidence it had: where the copy came from. */
const provenanceOf = (fact: FactRecord, sourceName: string) => ({
    kind: "note" as const,
    ref: `copy:${fact.id}`,
    label: `Copied from ${sourceName}`,
})

/**
 * A private fact of the source agent as the same fact kept for the new agent alone. It was approved there, so it is approved here
 * (applied at once; a scheduled one is scheduled again for its date); the evidence it had stays, with the provenance added.
 */
export const copiedFactOf = (
    fact: FactRecord,
    sourceName: string,
    targetInstallationId: string,
    proposedBy: string,
): FactInput => ({
    subjectType: fact.subjectType,
    subjectLabel: fact.subjectLabel,
    attributeLabel: fact.attributeLabel,
    value: fact.value,
    unit: fact.unit,
    scope: fact.scope,
    modules: fact.modules,
    sourceKind: fact.sourceKind,
    validFrom: fact.validFrom,
    validTo: fact.validTo,
    evidence: [...fact.evidence, provenanceOf(fact, sourceName)],
    proposedBy,
    installationId: targetInstallationId,
    autoApply: true,
})

/**
 * A private document of the source agent as a document kept for the new agent alone. A file is copied as the text read from it, a link
 * stays a link (read again), a note or Q&A list as it is; the copy tag comes first so it survives the tag limit.
 */
export const copiedDocumentOf = (
    document: InstanceDocument,
    moduleKey: string,
    targetInstallationId: string,
): AddSourceInput => ({
    kind: document.kind === "file" ? "text" : document.kind,
    title: document.title,
    ...(document.kind === "url" ? { url: document.content } : { content: document.content }),
    topic: document.topic ?? undefined,
    tags: [copyTagOf(document.id), ...document.tags],
    module: moduleKey,
    installationId: targetInstallationId,
    visibility: document.visibility,
})
