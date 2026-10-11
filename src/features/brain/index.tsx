"use client"

import { useEffect, useState } from "react"
import { Breadcrumbs, Button, DescriptionList, PageContainer, PrimaryRailLayout, SectionHeader, SurfaceCard, Tabs, Text, TextAction } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { planReview } from "@/lib/brain/conflicts"
import type { ExtractionInfo, Fact, Lesson } from "@/lib/brain/shared"
import { CreditsAlert } from "./CreditsAlert"
import { HEAD_CLASS, LENS_CLASS, PAGE_CLASS, STACK_CLASS } from "./classNames"
import { FactsPanel } from "./facts"
import { useRouter } from "next/navigation"
import { AddDocumentsDrawer } from "@/features/knowledge/AddDocumentsDrawer"
import { driveReturn } from "@/features/knowledge/driveReturn"
import { FactDrawer } from "./form"
import { LessonsPanel } from "./lessons"
import { MapPanel } from "./map"
import { BrainRail, type StarterPreset } from "./rail"
import { ReviewPanel } from "./review"
import type { BrainDoc, Lens } from "./shared"

/** Props for {@link BrainView}. */
export type BrainViewProps = {
  readonly facts: ReadonlyArray<Fact>
  /** The business documents (indexed for every agent). */
  readonly documents: ReadonlyArray<BrainDoc>
  readonly lessons: ReadonlyArray<Lesson>
  readonly lenses: ReadonlyArray<Lens>
  /** Where the reading of each document's facts stands. */
  readonly extractions?: ReadonlyArray<ExtractionInfo>
  readonly canWrite: boolean
  /** STATE-8: the same page while its data loads - labels stay, figures, the graph and the rail rows are skeletons. */
  readonly isLoading?: boolean
  /** The workspace's name: the subject of the starter facts (opening hours, address...). */
  readonly business: string
}

type Surface = "map" | "review" | "facts" | "lessons"

/**
 * Bộ não, laid out like Tri thức: header, actions, four key figures, then the active surface with the rail beside it
 * (agent views, what is worth adding, how it learns). Review opens first when something waits.
 */
export const BrainView = ({ facts, documents, lessons, lenses, extractions = [], canWrite, business, isLoading = false }: BrainViewProps) => {
  const t = useT(brain)
  const active = facts.filter((f) => f.status === "active")
  const scheduled = facts.filter((f) => f.status === "scheduled").length
  // One card per key: a key whose waiting values disagree counts once, and as a conflict (see planReview).
  const plan = planReview(facts)
  const conflicts = plan.conflicts
  const lessonsActive = lessons.filter((l) => l.status === "active").length
  const lessonsProposed = lessons.filter((l) => l.status === "proposed").length
  const waiting = plan.cards + lessonsProposed
  const reading = extractions.filter((x) => x.status === "queued" || x.status === "running").length
  const outOfCredits = extractions.some((x) => x.status === "blocked_credits")
  // While the brain is empty the empty state owns the one primary "add" (CTA-1 case-5); the header offers it once there is something.
  const isEmpty = facts.length === 0 && documents.length === 0
  const docsIndexing = documents.filter((d) => d.status !== "ready" && d.status !== "failed").length + reading

  const [surface, setSurface] = useState<Surface>(waiting > 0 && canWrite ? "review" : "map")
  const [lensKey, setLensKey] = useState<string | null>(null)
  const lens = lenses.find((l) => l.module === lensKey) ?? null
  const [drawer, setDrawer] = useState<{ preset?: StarterPreset } | null>(null)
  const [isAddingDocs, setAddingDocs] = useState(false)
  // Back from the Google Drive consent (?drive=ok|error): the Add documents drawer reopens with the pasted links kept.
  useEffect(() => { if (driveReturn()) setAddingDocs(true) }, [])
  const router = useRouter()
  const addDocs = () => setAddingDocs(true)

  const onLens = (module: string | null) => {
    setLensKey(module)
    if (surface !== "map" && surface !== "facts") setSurface("map")
  }

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "brain", label: t("title") }]} />
          <SectionHeader
            level={1}
            title={t("title")}
            description={t("intro")}
            meta={<TextAction href="/knowledge" size="sm" appearance="inline">{t("knowledgeLink")}</TextAction>}
            action={canWrite && !isEmpty && !isLoading ? <Button variant="primary" onPress={addDocs}>{t("addDocs")}</Button> : undefined}
          />
        </div>

        {outOfCredits && canWrite ? <CreditsAlert /> : null}

        <SurfaceCard ariaLabel={t("statsLabel")}>
          <DescriptionList
            isLoading={isLoading}
            layout="stat-strip"
            isDivided
            items={[
              { id: "docs", term: t("statDocs"), description: String(documents.length), meta: t("statDocsMeta", { n: String(docsIndexing) }) },
              { id: "facts", term: t("statFacts"), description: String(active.length), meta: t("statFactsMeta", { n: String(scheduled) }) },
              { id: "review", term: t("statReview"), description: String(waiting), meta: t("statReviewMeta", { n: String(conflicts) }) },
              { id: "agents", term: t("statAgents"), description: String(lenses.length), meta: t("statAgentsMeta") },
            ]}
          />
        </SurfaceCard>

        <PrimaryRailLayout
          railWidth="standard"
          primary={
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
              {lens && (surface === "map" || surface === "facts") ? (
                <div className={LENS_CLASS}>
                  <Text size="sm" tone="muted">{t("lensShowing", { agent: lens.name })}</Text>
                  <TextAction size="sm" appearance="inline" onPress={() => setLensKey(null)}>{t("lensClear")}</TextAction>
                </div>
              ) : null}
              {surface === "map" ? <MapPanel isLoading={isLoading} facts={facts} documents={documents} lens={lens} business={business} onAdd={canWrite ? addDocs : undefined} /> : null}
              {surface === "review" ? <ReviewPanel facts={facts} lessons={lessons} lenses={lenses} /> : null}
              {surface === "facts" ? <FactsPanel facts={facts} lenses={lenses} lens={lens} canWrite={canWrite} onAdd={canWrite ? addDocs : undefined} /> : null}
              {surface === "lessons" ? <LessonsPanel lessons={lessons} lenses={lenses} canWrite={canWrite} /> : null}
            </div>
          }
          rail={
            <BrainRail isLoading={isLoading} facts={facts} lenses={lenses} lens={lens} onLens={onLens} business={business} canWrite={canWrite}
              onStart={(preset) => setDrawer({ preset })} />
          }
        />
      </div>
      <AddDocumentsDrawer isOpen={isAddingDocs} onClose={() => setAddingDocs(false)} onAdded={() => router.refresh()} />
      {drawer ? (
        <FactDrawer key={drawer.preset?.attributeLabel ?? "new"} isOpen editing={null} lenses={lenses} preset={drawer.preset} onClose={() => setDrawer(null)} />
      ) : null}
    </PageContainer>
  )
}
