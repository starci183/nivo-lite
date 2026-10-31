/** One keyed piece of text the model may cite. */
export interface BundleItem {
    /** The key the model cites. */
    readonly key: string
    /** The text. */
    readonly text: string
}

/** The dossier under review as the bundle states it. */
export interface BundleDossier {
    /** The reference. */
    readonly ref: string
    /** The name. */
    readonly name: string
    /** The category. */
    readonly category: string
    /** How binding the dossier is. */
    readonly requirement: string
    /** The legal bases it rests on. */
    readonly basis: ReadonlyArray<string>
}

/** A dossier named by reference and name. */
export interface NamedDossier {
    /** The reference. */
    readonly ref: string
    /** The name. */
    readonly name: string
}

/** A document of the bundle with its passages. */
export interface BundleDocument {
    /** The key (S1). */
    readonly key: string
    /** The title. */
    readonly title: string
    /** actual, draft or template. */
    readonly state: string
    /** The date it bears, or null. */
    readonly date: string | null
    /** Its passages (S1.P1 ...). */
    readonly passages: ReadonlyArray<BundleItem>
}

/** Everything the model reads about one dossier; keys are the only way to cite. */
export interface DossierBundle {
    /** The workspace. */
    readonly workspaceId: string
    /** Today, YYYY-MM-DD. */
    readonly today: string
    /** The rule pack version. */
    readonly packVersion: string
    /** The dossier under review. */
    readonly dossier: BundleDossier
    /** The checklist row, key C1. */
    readonly checklist: BundleItem | null
    /** The related dossiers. */
    readonly related: ReadonlyArray<NamedDossier>
    /** The documents with their passages. */
    readonly documents: ReadonlyArray<BundleDocument>
    /** The facts. */
    readonly facts: ReadonlyArray<BundleItem>
    /** The issues already found. */
    readonly known: ReadonlyArray<BundleItem>
    /** The open model findings to re-judge. */
    readonly openAi: ReadonlyArray<BundleItem>
}

/** A quote the model cites by key. */
export interface CitedQuote {
    /** The key. */
    readonly key: string
    /** The words, copied from the cited item. */
    readonly quote: string
}

/** A finding the model proposes. */
export interface ReasonedFinding {
    /** The kind. */
    readonly kind: string
    /** The severity. */
    readonly severity: string
    /** The title. */
    readonly title: string
    /** The detail. */
    readonly detail: string
    /** The citations. */
    readonly evidence: ReadonlyArray<CitedQuote>
    /** The references of related dossiers. */
    readonly relatedRefs: ReadonlyArray<string>
    /** What completes it. */
    readonly remedyAction: string
    /** The kind of document that completes it. */
    readonly documentType: string | null
}

/** The model's verdict on one open model finding. */
export interface StillOpenVerdict {
    /** The key of the open finding (A1). */
    readonly key: string
    /** Whether it still applies. */
    readonly applies: boolean
    /** What resolves it, when it no longer applies. */
    readonly evidence: ReadonlyArray<CitedQuote>
}

/** What the model answers for one dossier. */
export interface ReasonedReview {
    /** The new findings. */
    readonly findings: ReadonlyArray<ReasonedFinding>
    /** The verdict on each open model finding. */
    readonly stillOpen: ReadonlyArray<StillOpenVerdict>
    /** The model that answered. */
    readonly model: string
    /** The prompt tokens used. */
    readonly promptTokens: number | null
    /** The completion tokens used. */
    readonly completionTokens: number | null
}

/** A review the model answered, or null when it is unavailable or its answer did not parse. */
export type MaybeReasonedReview = ReasonedReview | null

/** Reads a dossier critically; answers null when the model is unavailable or its answer did not parse. */
export interface DossierReasoner {
    /** Reviews the bundle. */
    review(bundle: DossierBundle): Promise<MaybeReasonedReview>
}

/** An evidence item of a finding as a draft is written from it. */
export interface RemedyEvidence {
    /** The label. */
    readonly label: string
    /** The verbatim quote, or null. */
    readonly quote: string | null
}

/** The finding a draft answers. */
export interface RemedyFinding {
    /** The kind. */
    readonly kind: string
    /** The severity. */
    readonly severity: string
    /** The title. */
    readonly title: string
    /** The detail. */
    readonly detail: string
    /** Its verified evidence. */
    readonly evidence: ReadonlyArray<RemedyEvidence>
}

/** The dossier a draft is filed under. */
export interface RemedyDossier extends NamedDossier {
    /** The category. */
    readonly category: string
}

/** What the pack says completes the finding. */
export interface RemedyGuide {
    /** The kind of document. */
    readonly documentType: string | null
    /** What NIVO drafts it from. */
    readonly guidance: string | null
}

/** What a draft is written from. */
export interface RemedyRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** Today, YYYY-MM-DD. */
    readonly today: string
    /** The finding with its verified evidence. */
    readonly finding: RemedyFinding
    /** The dossier. */
    readonly dossier: RemedyDossier
    /** What the pack says completes it. */
    readonly remedy: RemedyGuide
    /** The identity facts of the workspace, as lines. */
    readonly identity: ReadonlyArray<string>
    /** What the owner asked. */
    readonly instructions: string | null
}

/** A value a draft leaves to fill in. */
export interface RemedyPlaceholder {
    /** What the value is. */
    readonly label: string
    /** Why the model could not fill it. */
    readonly reason: string
}

/** A drafted document. */
export interface RemedyText {
    /** The title. */
    readonly title: string
    /** The kind of document. */
    readonly documentType: string
    /** The Markdown text. */
    readonly body: string
    /** The values left to fill in. */
    readonly placeholders: ReadonlyArray<RemedyPlaceholder>
    /** The model that wrote it. */
    readonly model: string
}

/** A drafted document, or null when the model is unavailable or its answer did not parse. */
export type MaybeRemedyText = RemedyText | null

/** Writes a document for a finding; answers null when the model is unavailable or its answer did not parse. */
export interface RemedyWriter {
    /** Drafts the document. */
    draft(request: RemedyRequest): Promise<MaybeRemedyText>
}
