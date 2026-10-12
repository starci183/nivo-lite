"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDialog, Badge, Breadcrumbs, Button, List, ListItem, PageContainer, SectionHeader, Skeleton, SurfaceCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { knowledge } from "@/i18n/dict/knowledge"
import { deleteKnowledge, reindexKnowledge, updateKnowledge } from "@/lib/knowledge/actions"
import { isKeywordOnlyNote, type KnowledgeChunk, type KnowledgeSource } from "@/lib/knowledge/shared"
import { ITEM_CLASS, LIST_CLASS, PAGE_CLASS, PASSAGE_CLASS, HEAD_CLASS, PASSAGE_TEXT_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "./classNames"
import { knowledgeTrail } from "./trail"

type SourceDetailProps = {
  /** Null while the source loads (isLoading). */
  readonly source: KnowledgeSource | null
  readonly chunks: ReadonlyArray<KnowledgeChunk>
  readonly canWrite: boolean
  /** STATE-8: the same page while its data loads - trail, card labels stay; the title, facts and passages are skeletons. */
  readonly isLoading?: boolean
}

/** One source: metadata, its passages as agents retrieve them, original content, reindex / visibility / delete. */
export const SourceDetail = ({ source, chunks, canWrite, isLoading = false }: SourceDetailProps) => {
  const t = useT(knowledge)
  const locale = useLocale()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"reindex" | "delete" | "vis" | null>(null)
  const [, start] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const act = (kind: "reindex" | "delete" | "vis", fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null)
    setBusy(kind)
    start(async () => {
      const r = await fn()
      setBusy(null)
      if (!r.ok) { setError(r.error ?? t("detailFailed")); return }
      after ? after() : router.refresh()
    })
  }
  if (source === null || isLoading) {
    return (
      <PageContainer measure="product">
        <div className={PAGE_CLASS} aria-busy="true">
          <div className={HEAD_CLASS}>
            <Breadcrumbs label={t("crumbLabel")} items={knowledgeTrail({ brain: t("crumbBrain"), docs: t("title") }, "").map((crumb) => crumb.id === "current" ? { ...crumb, isSkeleton: true as const } : crumb)} />
            <SectionHeader level={1} isSkeleton title="" description="" />
          </div>
          <div className={ROW_WRAP_CLASS}>
            <Badge isSkeleton tone="neutral">{t("status_ready")}</Badge>
            <Badge isSkeleton tone="neutral">{t("visInternalLong")}</Badge>
          </div>
          <SurfaceCard label={t("passagesTitle")} headingLevel={2}>
            <Skeleton shape="text" lines={4} />
          </SurfaceCard>
          <SurfaceCard label={t("contentTitle")} headingLevel={2}>
            <Skeleton shape="text" lines={6} />
          </SurfaceCard>
        </div>
      </PageContainer>
    )
  }
  const when = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(source.createdAt))
  const isPublic = source.visibility === "public"

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={knowledgeTrail({ brain: t("crumbBrain"), docs: t("title") }, source.title)} />
          <SectionHeader level={1} title={source.title} description={t("detailMeta", { when })} meta={source.topic ?? t(`kind_${source.kind}`)} />
        </div>
        <div className={ROW_WRAP_CLASS}>
          <Badge isDot tone={source.status === "ready" ? "success" : source.status === "failed" ? "danger" : "warning"}>{t(`status_${source.status}`)}</Badge>
          <Badge tone="neutral">{isPublic ? t("visPublicLong") : t("visInternalLong")}</Badge>
          <Text size="sm" tone="muted">{t("chunks", { count: source.chunkCount })}{source.module ? ` · ${t(`module_${source.module}`)}` : ""}</Text>
        </div>
        {source.error ? <Alert title={source.status === "failed" ? t("status_failed") : isKeywordOnlyNote(source.error) ? t("noVectors") : t("noFacts")} description={source.error} tone={source.status === "failed" ? "negative" : "neutral"} /> : null}
        {error !== null ? <Alert title={t("detailFailed")} description={error} tone="negative" /> : null}

        {canWrite ? (
          <div className={ROW_WRAP_CLASS}>
            <Button variant="secondary" isPending={busy === "reindex"} onPress={() => act("reindex", () => reindexKnowledge(source.id))}>{busy === "reindex" ? t("reindexing") : t("reindex")}</Button>
            <Button variant="secondary" isPending={busy === "vis"} onPress={() => act("vis", () => updateKnowledge(source.id, { visibility: isPublic ? "internal" : "public" }))}>{isPublic ? t("makeInternal") : t("makePublic")}</Button>
            <Button variant="ghost" isPending={busy === "delete"} onPress={() => setConfirmDelete(true)}>{busy === "delete" ? t("deleting") : t("delete")}</Button>
            <AlertDialog
              isOpen={confirmDelete}
              onOpenChange={setConfirmDelete}
              title={t("deleteConfirm")}
              confirmLabel={t("delete")}
              cancelLabel={t("addCancel")}
              onConfirm={() => { setConfirmDelete(false); act("delete", () => deleteKnowledge(source.id), () => router.push("/knowledge")) }}
            />
          </div>
        ) : null}

        <SurfaceCard label={t("passagesTitle")} headingLevel={2}>
          <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">{t("passagesHint")}</Text>
            {chunks.length > 0 ? (
              <List label={t("passagesTitle")} className={LIST_CLASS}>
                {chunks.map((c) => (
                  <ListItem key={c.id} className={ITEM_CLASS}>
                    <div className={PASSAGE_CLASS}>
                      <Text size="xs" tone="muted">#{c.ord + 1} · {c.hasEmbedding ? t("passageVector") : t("passageKeyword")} · {c.content.length}</Text>
                      <div className={PASSAGE_TEXT_CLASS}><Text size="sm">{c.content}</Text></div>
                    </div>
                  </ListItem>
                ))}
              </List>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard label={t("contentTitle")} headingLevel={2}>
          <div className={PASSAGE_TEXT_CLASS}><Text size="sm">{source.content.length > 6000 ? `${source.content.slice(0, 6000)} ...` : source.content}</Text></div>
        </SurfaceCard>
      </div>
    </PageContainer>
  )
}
