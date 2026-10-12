"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, DropdownMenu, EmptyNotice, IconButton, Input, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { useLocale, useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { retireFactAction } from "@/lib/brain/actions"
import { keyOf, visibleTo, type Fact } from "@/lib/brain/shared"
import { STACK_CLASS, TOOLBAR_CLASS, TOOLBAR_GROW_CLASS } from "./classNames"
import { FactDrawer } from "./form"
import { SCOPE_KEY, SCOPE_TONE, dateOf, sourceLabel, typeLabel, type Lens } from "./shared"

/** Props for {@link FactsPanel}. */
export type FactsPanelProps = {
  readonly facts: ReadonlyArray<Fact>
  readonly lenses: ReadonlyArray<Lens>
  /** The agent the owner is looking through, or null for the whole business. */
  readonly lens: Lens | null
  readonly canWrite: boolean
  /** The page command, offered here only while the brain is empty (the header drops it then: one primary per view). */
  readonly onAdd?: () => void
}

/** Every fact in force (and the ones scheduled to take over), grouped by subject, searchable, through the chosen lens. */
export const FactsPanel = ({ facts, lenses, lens, canWrite, onAdd }: FactsPanelProps) => {
  const t = useT(brain)
  const locale = useLocale()
  const router = useRouter()
  const [q, setQ] = useState("")
  const [drawer, setDrawer] = useState<{ editing: Fact | null } | null>(null)
  const [note, setNote] = useState<{ tone: "affirmative" | "negative"; text: string } | null>(null)
  const [, startTransition] = useTransition()

  const groups = useMemo(() => {
    const words = keyOf(q).split("-").filter(Boolean)
    const shown = facts.filter((f) => (f.status === "active" || f.status === "scheduled")
      && (!words.length || words.every((w) => `${f.subjectKey}-${f.attribute}-${keyOf(f.value)}`.includes(w))))
    const map = new Map<string, Array<Fact>>()
    for (const f of shown) map.set(f.subjectKey, [...(map.get(f.subjectKey) ?? []), f])
    return [...map.values()].sort((a, b) => a[0].subjectLabel.localeCompare(b[0].subjectLabel, "vi"))
  }, [facts, q])

  const retire = (f: Fact) => startTransition(async () => {
    const r = await retireFactAction(f.id)
    setNote(r.ok ? { tone: "affirmative", text: t("saved") } : { tone: "negative", text: r.error })
    if (r.ok) router.refresh()
  })

  return (
    <div className={STACK_CLASS}>
      <div className={TOOLBAR_CLASS}>
        <div className={TOOLBAR_GROW_CLASS}><Input id="brain-search" name="q" label={t("factsSearch")} variant="secondary" value={q} onValueChange={setQ} /></div>
        {canWrite ? <Button variant="primary" onPress={() => setDrawer({ editing: null })}>{t("addFact")}</Button> : null}
      </div>
      {note ? <Alert tone={note.tone} title={note.text} /> : null}
      {groups.length === 0 ? <EmptyNotice message={facts.length ? t("factsEmpty") : t("mapEmptyTitle")} description={facts.length ? undefined : t("mapEmptyBody")} actionLabel={!facts.length && onAdd ? t("emptyAction") : undefined} onAction={!facts.length ? onAdd : undefined} /> : null}
      {groups.map((g) => (
        <SurfaceListCard key={g[0].subjectKey} label={g[0].subjectLabel} headingLevel={2} labelEnd={<Badge tone="neutral">{typeLabel(t, g[0].subjectType)}</Badge>}>
          {g.map((f) => {
            const seen = !lens || visibleTo(f, lens.audience, lens.module)
            const when = f.status === "scheduled" && f.validFrom ? t("scheduledBadge", { date: dateOf(f.validFrom, locale) }) : null
            return (
              <ListRow
                key={f.id}
                title={f.attributeLabel}
                description={`${sourceLabel(t, f.sourceKind)} · ${f.decidedBy ?? f.proposedBy}${f.validTo ? ` · ${t("until", { date: dateOf(f.validTo, locale) })}` : ""}`}
                badges={<>{when ? <Badge tone="accent">{when}</Badge> : <Badge tone={SCOPE_TONE[f.scope]}>{t(SCOPE_KEY[f.scope])}</Badge>}</>}
                state={seen ? undefined : "unavailable"}
                actions={canWrite && f.status === "active" ? (
                  <>
                    <Button variant="outline" size="sm" onPress={() => setDrawer({ editing: f })}>{t("editValue")}</Button>
                    <DropdownMenu
                      placement="bottom end"
                      trigger={<IconButton source={nivoIconSource("disclosure", "leading")} label={t("history")} variant="ghost" />}
                      entries={[{ id: "retire", label: t("retire"), tone: "negative", onAction: () => retire(f) }]}
                    />
                  </>
                ) : undefined}
              >
                <Text size="sm" weight={seen ? "semibold" : undefined} tone={seen ? undefined : "muted"}>{seen ? f.value : t("hiddenValue")}</Text>
              </ListRow>
            )
          })}
        </SurfaceListCard>
      ))}
      {drawer ? <FactDrawer key={drawer.editing?.id ?? "new"} isOpen editing={drawer.editing} lenses={lenses} onClose={(m) => { setDrawer(null); if (m) setNote({ tone: "affirmative", text: m }) }} /> : null}
    </div>
  )
}
