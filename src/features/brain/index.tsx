"use client"

import { useState } from "react"
import { SegmentedControl, Tabs, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import type { Fact, Lesson } from "@/lib/brain/shared"
import { LENS_CLASS, STACK_CLASS } from "./classNames"
import { FactsPanel } from "./facts"
import { LessonsPanel } from "./lessons"
import { MapPanel } from "./map"
import { ReviewPanel } from "./review"
import type { Lens } from "./shared"

/** Props for {@link BrainView}. */
export type BrainViewProps = {
  readonly facts: ReadonlyArray<Fact>
  readonly lessons: ReadonlyArray<Lesson>
  readonly lenses: ReadonlyArray<Lens>
  readonly canWrite: boolean
}

type Surface = "map" | "review" | "facts" | "lessons"
const ALL = "all"

/**
 * Bộ não: one shared memory, seen through each agent's lens. Review is where the daily work is (it opens first when something waits);
 * the map shows health at a glance; facts and lessons are the full lists.
 */
export const BrainView = ({ facts, lessons, lenses, canWrite }: BrainViewProps) => {
  const t = useT(brain)
  const waiting = facts.filter((f) => f.status === "proposed").length + lessons.filter((l) => l.status === "proposed").length
  const [surface, setSurface] = useState<Surface>(waiting > 0 && canWrite ? "review" : "map")
  const [lensKey, setLensKey] = useState<string>(ALL)
  const lens = lenses.find((l) => l.module === lensKey) ?? null

  return (
    <div className={STACK_CLASS}>
      <Tabs
        label={t("tabsLabel")}
        selectedKey={surface}
        inset="none"
        labelVisibility="always"
        items={[
          { id: "map", label: t("tabMap") },
          ...(canWrite ? [{ id: "review", label: waiting ? `${t("tabReview")} (${waiting})` : t("tabReview") }] : []),
          { id: "facts", label: t("tabFacts") },
          { id: "lessons", label: t("tabLessons") },
        ]}
        onSelect={(k) => setSurface(k === "review" || k === "facts" || k === "lessons" ? k : "map")}
      />
      {surface === "map" || surface === "facts" ? (
        <div className={LENS_CLASS}>
          <SegmentedControl label={t("lensLabel")} value={lensKey} onValueChange={setLensKey}
            options={[{ value: ALL, label: t("lensAll") }, ...lenses.map((l) => ({ value: l.module, label: l.name }))]} />
          {lens ? <Text size="xs" tone="muted">{t("lensHint")}</Text> : null}
        </div>
      ) : null}
      {surface === "map" ? <MapPanel facts={facts} lens={lens} /> : null}
      {surface === "review" ? <ReviewPanel facts={facts} lessons={lessons} lenses={lenses} /> : null}
      {surface === "facts" ? <FactsPanel facts={facts} lenses={lenses} lens={lens} canWrite={canWrite} /> : null}
      {surface === "lessons" ? <LessonsPanel lessons={lessons} lenses={lenses} canWrite={canWrite} /> : null}
    </div>
  )
}
