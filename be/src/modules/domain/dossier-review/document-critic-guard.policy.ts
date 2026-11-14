import { PRODUCED_MODEL_KINDS, isCriticKind, type CriticKind } from "./document-critic.contracts"

/**
 * The guards on a point the MODEL raised. The model proposes; code keeps a point only when it is of the ONE kind the model is still
 * asked about (text addressed to an AI, `PRODUCED_MODEL_KINDS`) and quotes this document where it changed. Every guard is one narrow
 * test with a name (the drop reason), and each drops one point: the other points of the answer stand.
 */

/**
 * Why a model point was dropped:
 * - `bad_kind`: not a critic kind at all;
 * - `removed_kind`: a critic kind the model is no longer asked about (a typo, a vague or stale line, a contradiction ...: documents
 *   are trusted, and contradictions are the rules' own, from data);
 * - `no_quote`: no verbatim quote of this document; `unchanged_only`: no quote of a changed passage; `known`: a repeat.
 */
export type ModelDrop = "bad_kind" | "removed_kind" | "no_quote" | "unchanged_only" | "known"

const PRODUCED: ReadonlySet<string> = new Set<CriticKind>(PRODUCED_MODEL_KINDS)

/** Why a finding's kind is not kept, or null when it is the kind the model is asked about. By the kind's name only. */
export const kindDropOf = (kind: string): ModelDrop | null => {
    if (!isCriticKind(kind)) return "bad_kind"
    return PRODUCED.has(kind) ? null : "removed_kind"
}
