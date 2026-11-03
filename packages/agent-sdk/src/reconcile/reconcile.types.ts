/** Something that arrived and has to be matched to one of the open candidates: the amount it carries and the words that came with it. */
export interface Arrival {
    /** The arrival's own id. */
    readonly id: string
    /** The amount it carries. */
    readonly amount: number
    /** The text that came with it. */
    readonly text: string
    /** Other names it carries (a counter party), besides the text. */
    readonly names: ReadonlyArray<string>
    /** When it arrived, epoch milliseconds. */
    readonly at: number
}

/** Something open that an arrival may settle. */
export interface Candidate {
    /** The candidate's id. */
    readonly id: string
    /** A short line that names it for a person and for the judge. */
    readonly label: string
    /** The amount still due on it. */
    readonly amountDue: number
    /** The name of the party it belongs to, or null. */
    readonly partyName: string | null
    /** The key of the party it belongs to (the same key a claim carries), or null. */
    readonly partyKey: string | null
    /** The codes an arrival's text may name it by. */
    readonly codes: ReadonlyArray<string>
    /** When it was opened, epoch milliseconds. */
    readonly openedAt: number
}

/** Where a claim stands: open until an arrival settles it or the wait ran out. */
export type ClaimStatus = "open" | "settled" | "escalated"

/** A party's word that an arrival is on its way or has been made, before the arrival is seen. */
export interface Claim {
    /** The claim's id. */
    readonly id: string
    /** The party that made it, or null when it is not known. */
    readonly partyKey: string | null
    /** The amount the party named, or null when it named none. */
    readonly amount: number | null
    /** The names the party gave. */
    readonly names: ReadonlyArray<string>
    /** The party's own words. */
    readonly text: string
    /** When it was made, epoch milliseconds. */
    readonly at: number
    /** Where it stands. */
    readonly status: ClaimStatus
}

/** The kinds of evidence one candidate can show for an arrival. */
export type EvidenceKey = "code" | "amount" | "name" | "recency" | "claim"

/** One piece of evidence: whether it holds and, in words, why. */
export interface EvidenceItem {
    /** What kind it is. */
    readonly key: EvidenceKey
    /** Whether it holds. */
    readonly met: boolean
    /** The comparison that was made, for the record and the judge. */
    readonly detail: string
}

/** A candidate with the evidence for an arrival and the score the evidence adds up to. */
export interface Evidenced {
    /** The candidate. */
    readonly candidate: Candidate
    /** The evidence, one item per key. */
    readonly evidence: ReadonlyArray<EvidenceItem>
    /** The weighted sum of the evidence that holds. */
    readonly score: number
}

/** What the evidence is gathered under. */
export interface EvidenceOptions {
    /** The longest a candidate may have been open before the arrival for recency to hold, in milliseconds. */
    readonly windowMs: number
}

/** The judge's verdict: a match, no match, or a case a person has to decide. */
export type Verdict = "match" | "no_match" | "ambiguous"

/** What the judge answers. */
export interface Judgement {
    /** The verdict. */
    readonly verdict: Verdict
    /** The candidate a match names, or null. */
    readonly candidateId: string | null
    /** Why, in the judge's words. */
    readonly reasons: ReadonlyArray<string>
}

/** Everything the judge is given. */
export interface Brief {
    /** The arrival. */
    readonly arrival: Arrival
    /** The candidates with their evidence, best first. */
    readonly candidates: ReadonlyArray<Evidenced>
    /** The open claims. */
    readonly claims: ReadonlyArray<Claim>
}

/** The port the judge is behind: the model call of the host. Null when it could not answer. */
export type Judge = (brief: Brief) => Promise<Judgement | null>

/** Which step decided: the code and amount rule, no evidence at all, the judge, or the judge being unavailable. */
export type Stage = "code" | "no_evidence" | "judge" | "judge_unavailable"

/** What is done about an arrival. */
export type Effect =
    | { readonly kind: "apply"; readonly candidateId: string }
    | { readonly kind: "ask"; readonly candidateIds: ReadonlyArray<string> }
    | { readonly kind: "leave" }

/** The decision on an arrival: what to do, why, and the evidence it rested on. */
export interface Outcome {
    /** The step that decided. */
    readonly stage: Stage
    /** What to do. */
    readonly effect: Effect
    /** Why, for the record. */
    readonly reasons: ReadonlyArray<string>
    /** The candidates with their evidence. */
    readonly candidates: ReadonlyArray<Evidenced>
}

/** What the host does for each effect. */
export interface EffectHandlers<T> {
    /** The arrival settles the candidate. */
    readonly apply: (candidateId: string, outcome: Outcome) => Promise<T>
    /** A person decides among the candidates. */
    readonly ask: (candidateIds: ReadonlyArray<string>, outcome: Outcome) => Promise<T>
    /** The arrival stays as it is. */
    readonly leave: (outcome: Outcome) => Promise<T>
}
