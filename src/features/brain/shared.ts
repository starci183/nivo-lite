import type { Translate } from "@/i18n/core"
import type { brain } from "@/i18n/dict/brain"
import type { Audience, Fact, Scope, SourceKind, SubjectType } from "@/lib/brain/shared"

export type T = Translate<(typeof brain)["en"]>

/** One agent the owner can look through (the lens): its module, name and audience. */
export type Lens = { readonly module: string; readonly name: string; readonly audience: Audience }

export const SCOPE_KEY: Readonly<Record<Scope, "scopePublic" | "scopeInternal" | "scopeRestricted">> = { public: "scopePublic", internal: "scopeInternal", restricted: "scopeRestricted" }
export const SCOPE_TONE: Readonly<Record<Scope, "success" | "neutral" | "warning">> = { public: "success", internal: "neutral", restricted: "warning" }

const SOURCE_KEY: Readonly<Record<SourceKind, "srcOwner" | "srcManager" | "srcDocument" | "srcSystem" | "srcStaff" | "srcCustomer" | "srcAi">> = {
  owner: "srcOwner", manager: "srcManager", document: "srcDocument", system: "srcSystem", staff: "srcStaff", customer: "srcCustomer", ai: "srcAi",
}
export const sourceLabel = (t: T, k: SourceKind): string => t(SOURCE_KEY[k])

const TYPE_KEY: Readonly<Record<SubjectType, "tBusiness" | "tProduct" | "tService" | "tPolicy" | "tCustomer" | "tPerson" | "tSupplier" | "tPlace" | "tOther">> = {
  business: "tBusiness", product: "tProduct", service: "tService", policy: "tPolicy", customer: "tCustomer", person: "tPerson", supplier: "tSupplier", place: "tPlace", other: "tOther",
}
export const typeLabel = (t: T, k: SubjectType): string => t(TYPE_KEY[k])

/** A subject of the brain: its active facts and what is waiting for review about it. */
export type Subject = { readonly key: string; readonly label: string; readonly type: SubjectType; readonly active: ReadonlyArray<Fact>; readonly proposed: ReadonlyArray<Fact>; readonly scheduled: ReadonlyArray<Fact> }

export const subjectsOf = (facts: ReadonlyArray<Fact>): Array<Subject> => {
  const map = new Map<string, { label: string; type: SubjectType; active: Array<Fact>; proposed: Array<Fact>; scheduled: Array<Fact> }>()
  for (const f of facts) {
    if (f.status !== "active" && f.status !== "proposed" && f.status !== "scheduled") continue
    const s = map.get(f.subjectKey) ?? { label: f.subjectLabel, type: f.subjectType, active: [], proposed: [], scheduled: [] }
    if (f.status === "active") {
      s.active.push(f)
      s.label = f.subjectLabel
      s.type = f.subjectType
    } else if (f.status === "scheduled") s.scheduled.push(f)
    else s.proposed.push(f)
    map.set(f.subjectKey, s)
  }
  return [...map.entries()].map(([key, s]) => ({ key, ...s })).sort((a, b) => a.label.localeCompare(b.label, "vi"))
}

export const dateOf = (iso: string | null, locale: "vi" | "en"): string =>
  iso ? new Date(iso).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""

/** A document of the brain, as the page shows it (no content: the text stays on the server). */
export type BrainDoc = { readonly id: string; readonly title: string; readonly topic: string | null; readonly status: "pending" | "ready" | "failed" | string; readonly chunkCount: number }
