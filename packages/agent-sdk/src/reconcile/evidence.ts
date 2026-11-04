import type {
    Arrival,
    Candidate,
    Claim,
    EvidenceItem,
    EvidenceKey,
    EvidenceOptions,
    Evidenced,
} from "./reconcile.types"
import { mentionsCode, mentionsName } from "./text-match"

/** What each kind of evidence adds to a candidate's score when it holds. */
export const EVIDENCE_WEIGHTS: Readonly<Record<EvidenceKey, number>> = {
    code: 100,
    amount: 40,
    claim: 30,
    name: 25,
    recency: 5,
}

const HOUR_MS = 3_600_000

const item = (key: EvidenceKey, met: boolean, detail: string): EvidenceItem => ({ key, met, detail })

const codeOf = (arrival: Arrival, candidate: Candidate): EvidenceItem => {
    const named = candidate.codes.find((code) => mentionsCode(arrival.text, code))
    return item(
        "code",
        named !== undefined,
        named === undefined ? "no code of the candidate in the text" : `names ${named}`,
    )
}

const amountOf = (arrival: Arrival, candidate: Candidate): EvidenceItem =>
    item("amount", arrival.amount === candidate.amountDue, `${arrival.amount} against ${candidate.amountDue} due`)

const nameOf = (arrival: Arrival, candidate: Candidate): EvidenceItem => {
    const party = candidate.partyName
    const met = [arrival.text, ...arrival.names].some((words) => mentionsName(words, party))
    return item(
        "name",
        met,
        party === null ? "the candidate has no party name" : `"${party}" in the text or the counter name`,
    )
}

const recencyOf = (arrival: Arrival, candidate: Candidate, options: EvidenceOptions): EvidenceItem => {
    const age = arrival.at - candidate.openedAt
    return item(
        "recency",
        age >= 0 && age <= options.windowMs,
        `opened ${Math.round(age / HOUR_MS)} h before the arrival`,
    )
}

/** The open claims that speak for a candidate: the same party, and an amount that is the arrival's or none at all. */
export const claimsFor = (arrival: Arrival, candidate: Candidate, claims: ReadonlyArray<Claim>): ReadonlyArray<Claim> =>
    claims.filter(
        (claim) =>
            claim.status === "open" &&
            claim.partyKey !== null &&
            claim.partyKey === candidate.partyKey &&
            (claim.amount === null || claim.amount === arrival.amount),
    )

const claimOf = (arrival: Arrival, candidate: Candidate, claims: ReadonlyArray<Claim>): EvidenceItem => {
    const [first] = claimsFor(arrival, candidate, claims)
    return item(
        "claim",
        first !== undefined,
        first === undefined ? "no open claim of the party" : `the party said: ${first.text}`,
    )
}

/** Every kind of evidence one candidate shows for the arrival, and the score of the ones that hold. */
export const gatherEvidence = (
    arrival: Arrival,
    candidate: Candidate,
    claims: ReadonlyArray<Claim>,
    options: EvidenceOptions,
): Evidenced => {
    const evidence = [
        codeOf(arrival, candidate),
        amountOf(arrival, candidate),
        nameOf(arrival, candidate),
        recencyOf(arrival, candidate, options),
        claimOf(arrival, candidate, claims),
    ]
    const score = evidence.reduce((sum, one) => sum + (one.met ? EVIDENCE_WEIGHTS[one.key] : 0), 0)
    return { candidate, evidence, score }
}

/** The candidates with their evidence, best score first; a tie keeps the order given. */
export const scoreCandidates = (
    arrival: Arrival,
    candidates: ReadonlyArray<Candidate>,
    claims: ReadonlyArray<Claim>,
    options: EvidenceOptions,
): ReadonlyArray<Evidenced> =>
    candidates
        .map((candidate) => gatherEvidence(arrival, candidate, claims, options))
        .toSorted((left, right) => right.score - left.score)

/** Whether one kind of evidence holds for a candidate. */
export const holds = (evidenced: Evidenced, key: EvidenceKey): boolean =>
    evidenced.evidence.some((one) => one.key === key && one.met)

/** Whether anything but recency holds: recency alone says nothing about this arrival. */
export const hasSignal = (evidenced: Evidenced): boolean =>
    evidenced.evidence.some((one) => one.met && one.key !== "recency")
