"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge, Button, EmptyNotice, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { knowledge } from "@/i18n/dict/knowledge"
import { decideSuggestion } from "@/lib/knowledge/actions"
import type { KnowledgeSource, SourceStatus, Visibility } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { AddSource, type AddPreset } from "./AddSource"
import { AskPanel } from "./AskPanel"
import { FIELD_CLASS, GRID_CLASS, HEAD_ROW_CLASS, ITEM_CLASS, ITEM_MAIN_CLASS, LABEL_CLASS, LIST_CLASS, PAGE_CLASS, ROW_WRAP_CLASS, SIDE_CLASS, STACK_CLASS, SUGGEST_ITEM_CLASS, TITLE_LINK_CLASS } from "./classNames"

export type SuggestionView = { readonly key: string; readonly topic: string; readonly hint: string; readonly visibility: Visibility }
export type SkippedView = { readonly key: string; readonly topic: string; readonly state: "dismissed" | "not_applicable" }

type KnowledgeViewProps = {
  readonly sources: ReadonlyArray<KnowledgeSource>
  readonly topics: ReadonlyArray<string>
  readonly suggestions: ReadonlyArray<SuggestionView>
  readonly skipped: ReadonlyArray<SkippedView>
  readonly canWrite: boolean
  readonly initialModule: ModuleKey | "all"
  readonly askModule: ModuleKey
}

const STATUS_TONE: Record<SourceStatus, "neutral" | "warning" | "success" | "danger"> = { pending: "neutral", indexing: "warning", ready: "success", failed: "danger" }

/** /knowledge: sources of the workspace (shared by every agent), suggestions, and "Thử hỏi". */
export const KnowledgeView = ({ sources, topics, suggestions, skipped, canWrite, initialModule, askModule }: KnowledgeViewProps) => {
  const t = useT(knowledge)
  const locale = useLocale()
  const router = useRouter()
  const [filter, setFilter] = useState<"all" | ModuleKey>(initialModule)
  const [adding, setAdding] = useState(false)
  const [preset, setPreset] = useState<AddPreset | null>(null)
  const [isPending, start] = useTransition()

  const shown = sources.filter((s) => filter === "all" || s.module === null || s.module === filter)
  const when = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TIME_ZONE }).format(new Date(iso))
  const decide = (key: string, state: "dismissed" | "not_applicable" | null) => start(async () => { await decideSuggestion(key, state); router.refresh() })
  const openAdd = (p: AddPreset | null) => { setPreset(p); setAdding(true) }

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <div className={HEAD_ROW_CLASS}>
          <Link href="/knowledge/nivo" className="text-sm underline underline-offset-2">{t("nivoLink")}</Link>
          {canWrite && !adding ? <Button variant="primary" onPress={() => openAdd(null)}>{t("addButton")}</Button> : null}
        </div>
        {!canWrite ? <Text size="sm" tone="muted">{t("readOnlyNote")}</Text> : null}

        {adding && canWrite ? (
          <AddSource key={preset?.nonce ?? 0} topics={topics} preset={preset} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); router.refresh() }} />
        ) : null}

        <div className={GRID_CLASS}>
          <SurfaceCard label={t("listTitle")} headingLevel={2}>
            <div className={STACK_CLASS}>
              <div className={HEAD_ROW_CLASS}>
                <Text size="sm" tone="muted">{t("listCount", { count: shown.length })}</Text>
                <label className={`${LABEL_CLASS} sm:flex-row sm:items-center`}>
                  <span className="sr-only">{t("filterModule")}</span>
                  <select className={FIELD_CLASS} value={filter} onChange={(e) => setFilter(e.target.value as "all" | ModuleKey)}>
                    <option value="all">{t("filterAll")}</option>
                    {MODULE_KEYS.map((k) => <option key={k} value={k}>{t(`module_${k}`)}</option>)}
                  </select>
                </label>
              </div>
              {shown.length === 0 ? (
                <EmptyNotice message={t("emptyTitle")} description={t("emptyBody")} />
              ) : (
                <div className={LIST_CLASS}>
                  {shown.map((s) => (
                    <div key={s.id} className={ITEM_CLASS}>
                      <div className={ITEM_MAIN_CLASS}>
                        <Link href={`/knowledge/${s.id}`} className={TITLE_LINK_CLASS}>{s.title}</Link>
                        <Text size="xs" tone="muted">
                          {[s.topic, t(`kind_${s.kind}`), s.module ? t(`module_${s.module}`) : null, t("chunks", { count: s.chunkCount }), when(s.createdAt)].filter(Boolean).join(" · ")}
                        </Text>
                        {s.error ? <Text size="xs" tone="muted">{s.status === "failed" ? s.error : t("noVectors")}</Text> : null}
                      </div>
                      <div className={ROW_WRAP_CLASS}>
                        <Badge tone={s.visibility === "public" ? "success" : "neutral"}>{s.visibility === "public" ? t("vis_public") : t("vis_internal")}</Badge>
                        <Badge isDot tone={STATUS_TONE[s.status]}>{t(`status_${s.status}`)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SurfaceCard>

          <div className={SIDE_CLASS}>
            <AskPanel initialModule={askModule} />
            {canWrite ? (
              <SurfaceCard label={t("suggestTitle")} headingLevel={2}>
                <div className={STACK_CLASS}>
                  <Text size="sm" tone="muted">{t("suggestHint")}</Text>
                  {suggestions.length === 0 ? <Text size="sm" tone="muted">{t("suggestAllDone")}</Text> : null}
                  <div className={LIST_CLASS}>
                    {suggestions.map((s) => (
                      <div key={s.key} className={SUGGEST_ITEM_CLASS}>
                        <Text weight="semibold" size="sm">{s.topic}</Text>
                        <Text size="xs" tone="muted">{s.hint}</Text>
                        <div className={ROW_WRAP_CLASS}>
                          <Button variant="secondary" size="sm" onPress={() => openAdd({ topic: s.topic, visibility: s.visibility, nonce: Date.now() })}>{t("suggestAdd")}</Button>
                          <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => decide(s.key, "not_applicable")}>{t("suggestNotApplicable")}</Button>
                          <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => decide(s.key, "dismissed")}>{t("suggestDismiss")}</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {skipped.length > 0 ? (
                    <details>
                      <summary className="cursor-pointer text-sm text-muted">{t("suggestSkipped")} ({skipped.length})</summary>
                      <div className={LIST_CLASS}>
                        {skipped.map((s) => (
                          <div key={s.key} className={ITEM_CLASS}>
                            <div className={ITEM_MAIN_CLASS}>
                              <Text size="sm">{s.topic}</Text>
                              <Text size="xs" tone="muted">{s.state === "not_applicable" ? t("suggestNA") : t("suggestHidden")}</Text>
                            </div>
                            <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => decide(s.key, null)}>{t("suggestRestore")}</Button>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </SurfaceCard>
            ) : null}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
