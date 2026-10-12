import { sameValue, type Fact } from "./shared"

/**
 * What waits for the owner's review, grouped by key (subject + attribute). Pure: the Brain page, its counters and the review list all use
 * this one function, so a number on a tab is always the number of cards below it.
 *
 * Proposals of one key that carry DIFFERENT values are a conflict, whether or not a value is active yet (two documents disagree, or one
 * document says "5k" today and "7k" later). They show as ONE card with the competing values side by side. A key with a single proposal
 * that differs from the active value is a conflict too (shown as the usual "current vs proposed" row); a single proposal with nothing
 * active is a plain proposal. A "retire" proposal (no source left for an active value) is its own row, unless the key also has competing
 * values, in which case it joins that card as one more choice.
 */
export type Single = { readonly p: Fact; readonly current: Fact | null }

export type ConflictGroup = {
  readonly key: string
  readonly subjectLabel: string
  readonly attributeLabel: string
  readonly current: Fact | null
  /** The competing values (distinct), newest proposal first. */
  readonly options: ReadonlyArray<Fact>
  /** A waiting proposal to stop using the current value, if any. */
  readonly retire: Fact | null
}

export type ReviewPlan = {
  /** Keys whose proposals disagree with each other: one card each. */
  readonly groups: ReadonlyArray<ConflictGroup>
  /** One proposal for its key (a conflict when `current` is set, otherwise a plain proposal). */
  readonly singles: ReadonlyArray<Single>
  /** "No source left for this value" proposals standing alone. */
  readonly retires: ReadonlyArray<Single>
  /** Cards in the list: groups + singles + retires. */
  readonly cards: number
  /** Cards that are a conflict: every group, plus singles that differ from the active value. */
  readonly conflicts: number
}

const keyOf = (f: Pick<Fact, "subjectKey" | "attribute">): string => `${f.subjectKey}|${f.attribute}`

export const planReview = (facts: ReadonlyArray<Fact>): ReviewPlan => {
  const active = new Map<string, Fact>()
  const sets = new Map<string, Array<Fact>>()
  const retiring = new Map<string, Fact>()
  for (const f of facts) {
    if (f.status === "active") active.set(keyOf(f), f)
    else if (f.status === "proposed") {
      if (f.proposalKind === "retire") retiring.set(keyOf(f), f)
      else sets.set(keyOf(f), [...(sets.get(keyOf(f)) ?? []), f])
    }
  }
  const newestFirst = (a: Fact, b: Fact) => b.proposedAt.localeCompare(a.proposedAt)
  const groups: Array<ConflictGroup> = []
  const singles: Array<Single> = []
  const retires: Array<Single> = []
  for (const [key, list] of sets) {
    const options = [...list].sort(newestFirst).filter((o, i, all) => all.findIndex((x) => sameValue(x.value, o.value)) === i)
    const current = active.get(key) ?? null
    const retire = retiring.get(key) ?? null
    const first = options[0] as Fact
    if (options.length >= 2 || (options.length === 1 && retire)) {
      groups.push({ key, subjectLabel: first.subjectLabel, attributeLabel: first.attributeLabel, current, options, retire })
    } else {
      for (const p of list) singles.push({ p, current })
    }
  }
  for (const [key, p] of retiring) if (!sets.has(key)) retires.push({ p, current: active.get(key) ?? null })
  singles.sort((a, b) => Number(b.current !== null) - Number(a.current !== null) || b.p.proposedAt.localeCompare(a.p.proposedAt))
  groups.sort((a, b) => (b.options[0] as Fact).proposedAt.localeCompare((a.options[0] as Fact).proposedAt))
  return {
    groups, singles, retires,
    cards: groups.length + singles.length + retires.length,
    conflicts: groups.length + singles.filter((s) => s.current !== null).length,
  }
}

/** Whether a subject's proposals form a conflict (for the map's colour): a differing active value, or disagreeing proposals. */
export const hasConflict = (active: ReadonlyArray<Fact>, proposed: ReadonlyArray<Fact>): boolean => {
  const by = new Map<string, Array<Fact>>()
  for (const p of proposed) if (p.proposalKind === "set") by.set(p.attribute, [...(by.get(p.attribute) ?? []), p])
  for (const [attribute, list] of by) {
    if (active.some((a) => a.attribute === attribute)) return true
    if (list.some((y) => !sameValue(y.value, (list[0] as Fact).value))) return true
  }
  return false
}
