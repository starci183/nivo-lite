import type { FactReach, FactSource, Scope } from "./brain-facts.contracts"

/** Who may read a value, without the instance it is kept for. */
export type Readers = Pick<FactReach, "scope" | "modules">

/** Who decided a version and why: what tells the founder's own audience switch apart. */
export interface DecidedVersion {
    /** Why the version was written. */
    readonly decisionNote: string | null
    /** Who decided it. */
    readonly decidedBy: string | null
}

/** The readers of a truth in force with how its version was decided, or null when no value is in force. */
export type ReadersInForce = (Readers & DecidedVersion) | null

/** The readers a writer states, or null when it states none. */
export type StatedReaders = Readers | null

/** Who acts for the brain itself when no person decides. */
export const BRAIN_ACTOR = "NIVO"

/** How wide each scope reads: restricted (named modules) < internal (every internal agent and the staff) < public (customers too). */
const WIDTH: Readonly<Record<Scope, number>> = { restricted: 0, internal: 1, public: 2 }

/** The decision note of a version that only changes who reads the value; its opening words tell such a version apart. */
export const REACH_NOTE_PREFIX = "Who reads it changed:"

/** The note of a new version that only changes who reads the value. */
export const reachNoteOf = (from: Readers, to: Readers, why?: string): string =>
    `${REACH_NOTE_PREFIX} ${[from.scope, ...from.modules].join(" ")} -> ${[to.scope, ...to.modules].join(" ")}${
        why === undefined ? "" : ` (${why})`
    }`

/**
 * The union of two audiences (D-BR-1): whoever may read either may read the result. Public wins over everything, internal over
 * restricted, and two restricted audiences read by the modules of both.
 */
export const widestReaders = (one: Readers, other: Readers): Readers => {
    if (WIDTH[one.scope] !== WIDTH[other.scope]) {
        const wider = WIDTH[one.scope] > WIDTH[other.scope] ? one : other
        return { scope: wider.scope, modules: wider.scope === "restricted" ? [...wider.modules] : [] }
    }
    if (one.scope !== "restricted") return { scope: one.scope, modules: [] }
    return {
        scope: "restricted",
        modules: [...new Set([...one.modules, ...other.modules])].sort((a, b) => a.localeCompare(b)),
    }
}

/** Whether `to` lets someone read who `from` did not (a wider scope, or more modules of a restricted one). */
export const widensReaders = (from: Readers, to: Readers): boolean => {
    if (WIDTH[to.scope] !== WIDTH[from.scope]) return WIDTH[to.scope] > WIDTH[from.scope]
    return to.scope === "restricted" && to.modules.some((module) => !from.modules.includes(module))
}

/**
 * Whether the founder chose who reads this version himself ("Khach duoc biet" on the policy tab, `setReach`): a version whose only change
 * was its audience, decided by a person, not by the brain. Evidence never overrides that choice; only the founder's switch changes it again.
 */
export const founderChoseReaders = (fact: DecidedVersion): boolean =>
    fact.decisionNote !== null &&
    fact.decisionNote.startsWith(REACH_NOTE_PREFIX) &&
    fact.decidedBy !== null &&
    fact.decidedBy !== BRAIN_ACTOR

/**
 * The audience a source's line gives a truth (D-BR-1), the ONE rule every write door uses: evidence from a wider audience widens the
 * audience; a narrower repetition never narrows it. So a public document that repeats an internal truth makes it public, an internal
 * document that repeats or changes a public truth leaves it public, and a merge of two lines reads by the union. Two exceptions, both
 * the founder's: what he states himself on the Second Brain page (`owner` / `manager` writing a scope) is taken as stated, and a truth
 * whose audience he set with the switch keeps it (`founderChoseReaders`).
 */
export const readersOfEvidence = (stated: StatedReaders, current: ReadersInForce, sourceKind: FactSource): Readers => {
    if (current === null) return stated ?? { scope: "internal", modules: [] }
    const kept: Readers = { scope: current.scope, modules: [...current.modules] }
    if (stated === null) return kept
    if (sourceKind === "owner" || sourceKind === "manager") return stated
    if (founderChoseReaders(current)) return kept
    return widestReaders(kept, stated)
}

/**
 * The audience of a NEW VALUE of a known truth (owner 2026-11-12, strict "area = audience": no silent public exposure). The value
 * reads by what ITS OWN source says: a value stated by a public-area document (or by the founder with a scope) takes that audience;
 * a value from anything else (an internal-area document, a chat, staff, the model) that would replace a PUBLIC value is INTERNAL:
 * it becomes public only when a public-area document states it (the founder uploads or moves one) or he sets the switch. It never
 * widens: a truth restricted to named modules stays restricted. The founder's own statement is taken as he states it
 * (`readersOfEvidence`). The same value said again is not this rule's: evidence still widens (`readersOfEvidence`).
 */
export const readersOfNewValue = (stated: StatedReaders, current: ReadersInForce, sourceKind: FactSource): Readers => {
    if (current === null || sourceKind === "owner" || sourceKind === "manager") return readersOfEvidence(stated, current, sourceKind)
    if (stated !== null) return stated
    return current.scope === "public" ? { scope: "internal", modules: [] } : { scope: current.scope, modules: [...current.modules] }
}

/**
 * The decision note of a version whose audience changed because a document it was read from MOVED between the two upload areas. Its
 * opening words differ from `REACH_NOTE_PREFIX` on purpose: a move is not the founder's switch, so `founderChoseReaders` stays false
 * for it and the next move re-labels the truth again.
 */
export const AREA_NOTE_PREFIX = "Its document moved:"

/** The note of a version a document's move re-labelled: which document, from which area to which, and the audience change. */
export const areaNoteOf = (from: Readers, to: Readers, move: string): string =>
    `${AREA_NOTE_PREFIX} ${move}; readers ${[from.scope, ...from.modules].join(" ")} -> ${[to.scope, ...to.modules].join(" ")}`

/** Who wrote a truth and how its audience was last decided: what decides whether a move may re-label it. */
export interface MovedTruth extends DecidedVersion, Readers {
    /** Who the truth came from: the founder's own statement (`owner`, `manager`) keeps its audience through a move. */
    readonly sourceKind: FactSource
}

/** The audience a move gives a truth, or null when the truth keeps its own. */
export type MovedReaders = Readers | null

/**
 * The audience a truth takes after a document it was read from moved area (owner 2026-11-12: "what you upload is what you get"; no
 * model, no word decides it): public when at least one of its documents is in the PUBLIC area, else internal. Null keeps the truth as
 * it is: the founder set its audience with his switch (`founderChoseReaders`), or it is his own statement (source `owner` /
 * `manager`: what he states is taken as stated), or it already reads so; a restricted truth that does not become public keeps its
 * modules (it is already narrower than internal).
 */
export const readersAfterMove = (truth: MovedTruth, anyPublicDocument: boolean): MovedReaders => {
    if (founderChoseReaders(truth) || truth.sourceKind === "owner" || truth.sourceKind === "manager") return null
    if (anyPublicDocument) return truth.scope === "public" ? null : { scope: "public", modules: [] }
    return truth.scope === "public" ? { scope: "internal", modules: [] } : null
}
