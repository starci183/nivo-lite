"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Breadcrumbs, Button, Disclosure, EmptyNotice, Link, List, ListItem, PageContainer, PrimaryRailLayout, SectionHeader, Select, SurfaceCard, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { knowledge } from "@/i18n/dict/knowledge"
import { decideSuggestion } from "@/lib/knowledge/actions"
import { useLiveSources } from "@/lib/knowledge/live"
import { retrySource } from "@/lib/knowledge/queue"
import { isInFlight, type KnowledgeSource, type SourceStatus, type Visibility } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { AddDocumentsDrawer, type AddPreset, type InstanceOption } from "./AddDocumentsDrawer"
import { AskPanel } from "./AskPanel"
import { driveReturn } from "./driveReturn"
import { FILTER_CLASS, HEAD_CLASS, ITEM_CLASS, ITEM_MAIN_CLASS, LIST_CLASS, PAGE_CLASS, ROW_WRAP_CLASS, SIDE_CLASS, SOURCE_ROW_CLASS, STACK_CLASS, SUGGEST_ITEM_CLASS } from "./classNames"
import { knowledgeTrail } from "./trail"

export type SuggestionView = { readonly key: string; readonly topic: string; readonly hint: string; readonly visibility: Visibility }
export type SkippedView = { readonly key: string; readonly topic: string; readonly state: "dismissed" | "not_applicable" }

type KnowledgeViewProps = {
  readonly sources: ReadonlyArray<KnowledgeSource>
  readonly topics: ReadonlyArray<string>
  readonly suggestions: ReadonlyArray<SuggestionView>
  readonly skipped: ReadonlyArray<SkippedView>
  readonly canWrite: boolean
  /** The workspace: the live list follows its knowledge_sources, and the drawer uploads under its prefix. */
  readonly workspaceId: string
  readonly initialModule: ModuleKey | "all"
  readonly askModule: ModuleKey
  /** Agent instances a document may be kept for (types with several instances); their names label restricted documents. */
  readonly instances?: ReadonlyArray<InstanceOption>
  /** STATE-8: the same page while its data loads - labels stay, the sources and suggestion rows are skeletons. */
  readonly isLoading?: boolean
}

const STATUS_TONE: Record<SourceStatus, "neutral" | "warning" | "success" | "danger"> = {
  pending: "neutral", queued: "neutral", reading: "warning", indexing: "warning", extracting_facts: "warning", ready: "success", failed: "danger", blocked_credits: "warning",
}

/** /knowledge: sources of the workspace (shared by every agent), suggestions, and "Thử hỏi". */
export const KnowledgeView = ({ sources: initialSources, topics, suggestions, skipped, canWrite, workspaceId, initialModule, askModule, instances = [], isLoading = false }: KnowledgeViewProps) => {
  const t = useT(knowledge)
  const locale = useLocale()
  const router = useRouter()
  const [filter, setFilter] = useState<"all" | ModuleKey>(initialModule)
  const [adding, setAdding] = useState(false)
  const [preset, setPreset] = useState<AddPreset | null>(null)
  // Back from the Google Drive consent (?drive=ok|error): the Add documents drawer reopens with the pasted links kept.
  useEffect(() => { if (driveReturn()) setAdding(true) }, [])
  const [isPending, start] = useTransition()
  // Realtime: new sources appear at the top as they are created, and a worker's status and progress show as they change.
  const sources = useLiveSources(workspaceId, initialSources)
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set())
  const [retryFailed, setRetryFailed] = useState(false)

  const shown = sources.filter((s) => filter === "all" || s.module === null || s.module === filter)
  const when = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TIME_ZONE }).format(new Date(iso))
  const decide = (key: string, state: "dismissed" | "not_applicable" | null) => start(async () => { await decideSuggestion(key, state); router.refresh() })
  const openAdd = (p: AddPreset | null) => { setPreset(p); setAdding(true) }
  const retry = async (id: string) => {
    setRetryFailed(false)
    setRetrying((cur) => new Set(cur).add(id))
    try {
      await retrySource(id)
    } catch {
      setRetryFailed(true)
    } finally {
      setRetrying((cur) => { const next = new Set(cur); next.delete(id); return next })
    }
  }
  const statusLabel = (s: KnowledgeSource): string => (isInFlight(s.status) && s.progress > 0 && s.progress < 100 ? `${t(`status_${s.status}`)} ${s.progress}%` : t(`status_${s.status}`))

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={knowledgeTrail({ brain: t("crumbBrain"), docs: t("title") })} />
          <SectionHeader
            level={1}
            title={t("title")}
            description={t("description")}
            meta={<TextAction href="/knowledge/nivo" size="sm" appearance="inline">{t("nivoLink")}</TextAction>}
            action={canWrite && !isLoading ? <Button variant="primary" onPress={() => openAdd(null)}>{t("addButton")}</Button> : undefined}
          />
        </div>
        {!canWrite && !isLoading ? <Text size="sm" tone="muted">{t("readOnlyNote")}</Text> : null}

        {canWrite ? (
          <AddDocumentsDrawer isOpen={adding} workspaceId={workspaceId} topics={topics} preset={preset} instances={instances} onClose={() => setAdding(false)} onAdded={() => router.refresh()} />
        ) : null}

        <PrimaryRailLayout
          railWidth="standard"
          primary={
            <div className={STACK_CLASS}>
              <div className={FILTER_CLASS}>
                <Select
                  label={t("filterModule")} variant="primary" value={filter} isSkeleton={isLoading}
                  options={[{ id: "all", label: t("filterAll") }, ...MODULE_KEYS.map((k) => ({ id: k, label: t(`module_${k}`) }))]}
                  onValueChange={(v) => setFilter(MODULE_KEYS.find((k) => k === v) ?? "all")}
                />
              </div>
              {retryFailed ? <Alert tone="negative" title={t("errEnqueue")} /> : null}
              <SurfaceListCard
                label={t("listTitle")}
                headingLevel={2}
                isLoading={isLoading}
                {...(isLoading ? {} : { fact: t("listCount", { count: shown.length }) })}
                empty={<EmptyNotice message={t("emptyTitle")} description={t("emptyBody")} />}
              >
                {shown.length === 0 ? null : shown.map((s) => (
                  <li key={s.id} className={SOURCE_ROW_CLASS}>
                    <div className={ITEM_MAIN_CLASS}>
                      <Text weight="semibold" overflow="truncate"><Link href={`/knowledge/${s.id}`} visited="uniform">{s.title}</Link></Text>
                      <Text size="xs" tone="muted">
                        {[s.topic, t(`kind_${s.kind}`), s.installationId ? (instances.find((i) => i.id === s.installationId)?.label ?? null) : s.module ? t(`module_${s.module}`) : null, t("chunks", { count: s.chunkCount }), when(s.createdAt)].filter(Boolean).join(" · ")}
                      </Text>
                      {s.error ? <Text size="xs" tone="muted">{s.status === "failed" ? s.error : t("noVectors")}</Text> : null}
                    </div>
                    <div className={ROW_WRAP_CLASS}>
                      <Badge isDot tone={STATUS_TONE[s.status]}>{statusLabel(s)}</Badge>
                      <Badge tone="neutral">{s.visibility === "public" ? t("vis_public") : t("vis_internal")}</Badge>
                      {canWrite && s.status === "failed" ? <Button variant="ghost" size="sm" isPending={retrying.has(s.id)} onPress={() => { void retry(s.id) }}>{t("retry")}</Button> : null}
                      {s.status === "blocked_credits" ? <TextAction href="/billing" size="sm" appearance="inline">{t("creditsLink")}</TextAction> : null}
                    </div>
                  </li>
                ))}
              </SurfaceListCard>
            </div>
          }
          rail={
            <div className={SIDE_CLASS}>
              <AskPanel initialModule={askModule} />
              {isLoading ? <SurfaceListCard label={t("suggestTitle")} headingLevel={2} isLoading /> : null}
              {canWrite && !isLoading ? (
                <SurfaceCard label={t("suggestTitle")} headingLevel={2}>
                  <div className={STACK_CLASS}>
                    <Text size="sm" tone="muted">{t("suggestHint")}</Text>
                    {suggestions.length === 0 ? <Text size="sm" tone="muted">{t("suggestAllDone")}</Text> : (
                      <List label={t("suggestTitle")} className={LIST_CLASS}>
                        {suggestions.map((s) => (
                          <ListItem key={s.key} className={SUGGEST_ITEM_CLASS}>
                            <Text weight="semibold" size="sm">{s.topic}</Text>
                            <Text size="xs" tone="muted">{s.hint}</Text>
                            <div className={ROW_WRAP_CLASS}>
                              <Button variant="secondary" size="sm" onPress={() => openAdd({ topic: s.topic, visibility: s.visibility, nonce: Date.now() })}>{t("suggestAdd")}</Button>
                              <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => decide(s.key, "not_applicable")}>{t("suggestNotApplicable")}</Button>
                              <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => decide(s.key, "dismissed")}>{t("suggestDismiss")}</Button>
                            </div>
                          </ListItem>
                        ))}
                      </List>
                    )}
                    {skipped.length > 0 ? (
                      <Disclosure title={`${t("suggestSkipped")} (${skipped.length})`} headingLevel={3}>
                        <List label={t("suggestSkipped")} className={LIST_CLASS}>
                          {skipped.map((s) => (
                            <ListItem key={s.key} className={ITEM_CLASS}>
                              <div className={ITEM_MAIN_CLASS}>
                                <Text size="sm">{s.topic}</Text>
                                <Text size="xs" tone="muted">{s.state === "not_applicable" ? t("suggestNA") : t("suggestHidden")}</Text>
                              </div>
                              <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => decide(s.key, null)}>{t("suggestRestore")}</Button>
                            </ListItem>
                          ))}
                        </List>
                      </Disclosure>
                    ) : null}
                  </div>
                </SurfaceCard>
              ) : null}
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}
