import type {
    FindingEvidence,
    FindingOrigin,
    FindingSeverity,
    RemedyAction,
    ReviewStatus,
} from "./dossier-review.contracts"

/** The id of the stand-in dossier that holds the documents no dossier claims, so the rules read them on their own; its findings are filed under no dossier. */
export const UNFILED_DOSSIER_ID = "unfiled"

/** The name of the stand-in dossier; the words people read come from the message catalog (`unfiled.label`) when a finding is worded. */
export const UNFILED_DOSSIER_NAME = "{unfiled}"

/** The kinds of dossier the rule pack knows. */
export type PackRequirement = "required" | "conditional" | "optional" | "template"

/** The events a document must reflect once they happened. */
export type EventKey = "capital_transfer" | "member_change" | "registration_change" | "legal_rep_change" | "role_change"

/** The roles whose holders the rules compare. */
export type RoleKey = "accountant" | "legal_representative" | "director" | "council_chair" | "controller" | "employee"

/** A thing a dossier is expected to hold. */
export interface Expectation {
    /** Its stable key. */
    readonly key: string
    /** What it is, for people. */
    readonly label: string
    /** Folded words a document title may carry. */
    readonly titleAny: ReadonlyArray<string>
    /** Folded words a passage may carry. */
    readonly textAny: ReadonlyArray<string>
    /** The role whose holder the document must name. */
    readonly about: RoleKey | null
    /** Whether only a signed document counts. */
    readonly signed: boolean
    /** How much its absence matters. */
    readonly severity: FindingSeverity
}

/** What the rule pack says about one dossier. */
export interface PackEntry {
    /** The reference. */
    readonly ref: string
    /** Slugs the dossier name must contain. */
    readonly nameHint: ReadonlyArray<string>
    /** How binding the dossier is. */
    readonly requirement: PackRequirement
    /** The legal bases. */
    readonly basis: ReadonlyArray<string>
    /** What it must hold. */
    readonly expects: ReadonlyArray<Expectation>
    /** The events it must reflect. */
    readonly mustReflect: ReadonlyArray<EventKey>
    /** Whether its documents carry an expiry date. */
    readonly tracksExpiry: boolean
    /** The references of related dossiers. */
    readonly related: ReadonlyArray<string>
    /** What completes a gap in it. */
    readonly remedy: { readonly documentType: string; readonly guidance: string; readonly action: RemedyAction } | null
}

/** Whether a document is the real thing, a draft or a template. */
export type DocumentState = "actual" | "draft" | "template"

/** A dossier as the review reads it. */
export interface DossierRef {
    /** The dossier id. */
    readonly id: string
    /** The reference. */
    readonly ref: string
    /** The name. */
    readonly name: string
    /** The category. */
    readonly category: string
    /** Where it sits. */
    readonly position: number
    /** The imported checklist status. */
    readonly checklistStatus: ReviewStatus
    /** The documents the checklist says are held. */
    readonly existing: string | null
    /** What the checklist says is missing. */
    readonly missing: string | null
    /** The drafts the checklist lists. */
    readonly drafts: string | null
}

/** One passage of a document. */
export interface PassageInput {
    /** The passage id. */
    readonly id: string
    /** Its order in the document. */
    readonly order: number
    /** Its text. */
    readonly text: string
}

/** A document of a dossier as the review reads it. */
export interface DocumentInput {
    /** The source id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The tags. */
    readonly tags: ReadonlyArray<string>
    /** Where it came from. */
    readonly origin: string | null
    /** Actual, draft or template. */
    readonly state: DocumentState
    /** The date it bears, YYYY-MM-DD. */
    readonly date: string | null
    /** The last change, ISO 8601. */
    readonly updatedAt: string
    /** How many passages are stored. */
    readonly chunkCount: number
    /** Its passages in order. */
    readonly passages: ReadonlyArray<PassageInput>
}

/** A fact as the rules read it. */
export interface ReviewFact {
    /** The fact id. */
    readonly id: string
    /** The normalised subject. */
    readonly subjectKey: string
    /** The subject as written. */
    readonly subject: string
    /** The attribute slug. */
    readonly attribute: string
    /** The attribute as written. */
    readonly attributeLabel: string
    /** The value as written. */
    readonly value: string
    /** The value as a number. */
    readonly valueNumber: number | null
    /** The unit. */
    readonly unit: string | null
    /** The fact status. */
    readonly status: string
    /** From when it holds, YYYY-MM-DD. */
    readonly validFrom: string | null
    /** Until when it holds, YYYY-MM-DD. */
    readonly validTo: string | null
    /** The fact it disagrees with. */
    readonly conflictWith: string | null
    /** The documents that cite it. */
    readonly sourceIds: ReadonlyArray<string>
    /** The quotes its evidence carries. */
    readonly quotes: ReadonlyArray<string>
    /** The last change, ISO 8601. */
    readonly updatedAt: string
}

/** Everything the review reads about one dossier. */
export interface DossierInputs {
    /** The dossier. */
    readonly dossier: DossierRef
    /** What the pack says about it, or null. */
    readonly entry: PackEntry | null
    /** Its documents. */
    readonly documents: ReadonlyArray<DocumentInput>
    /** The facts its documents cite. */
    readonly facts: ReadonlyArray<ReviewFact>
}

/** The dossiers a rule pass evaluates together. */
export interface ReviewContext {
    /** Today, YYYY-MM-DD. */
    readonly today: string
    /** The dossiers evaluated. */
    readonly dossiers: ReadonlyArray<DossierInputs>
    /** The active facts of the workspace, the canonical values identifiers are checked against. */
    readonly activeFacts: ReadonlyArray<ReviewFact>
}

/** A finding before it is stored. */
export interface FindingCandidate {
    /** The rule, or `ai`. */
    readonly ruleKey: string
    /** The dossier id it is filed under. */
    readonly dossierId: string | null
    /** The other dossiers it touches. */
    readonly relatedDossierIds: ReadonlyArray<string>
    /** What is wrong. */
    readonly kind: string
    /** How much it matters. */
    readonly severity: string
    /** Rule or model. */
    readonly origin: FindingOrigin
    /** The message code of a rule finding. */
    readonly code: string | null
    /** The message params. */
    readonly params: Readonly<Record<string, string>>
    /** The title, empty for a rule candidate until rendered. */
    readonly title: string
    /** The detail, likewise. */
    readonly detail: string
    /** The evidence. */
    readonly evidence: ReadonlyArray<FindingEvidence>
    /** What completes it. */
    readonly remedyAction: string
    /** The kind of document that completes it. */
    readonly remedyDocumentType: string | null
    /** What identifies it within its rule. */
    readonly subject: string
}

/** What a rule pass found and which (rule, dossier) pairs it evaluated. */
export interface RuleOutput {
    /** The candidates. */
    readonly candidates: ReadonlyArray<FindingCandidate>
    /** The coverage keys evaluated. */
    readonly coverage: ReadonlyArray<string>
}
