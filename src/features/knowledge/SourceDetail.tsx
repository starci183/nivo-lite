"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { knowledge } from "@/i18n/dict/knowledge"
import { deleteKnowledge, reindexKnowledge, updateKnowledge } from "@/lib/knowledge/actions"
import type { KnowledgeChunk, KnowledgeSource } from "@/lib/knowledge/shared"
import { PAGE_CLASS, PASSAGE_CLASS, PASSAGE_TEXT_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "./classNames"

type SourceDetailProps = { readonly source: KnowledgeSource; readonly chunks: ReadonlyArray<KnowledgeChunk>; readonly canWrite: boolean }

/** One source: metadata, its passages as agents retrieve them, original content, reindex / visibility / delete. */
export const SourceDetail = ({ source, chunks, canWrite }: SourceDetailProps) => {
  const t = useT(knowledge)
  const locale = useLocale()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"reindex" | "delete" | "vis" | null>(null)
  const [, start] = useTransition()

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
  const when = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(source.createdAt))
  const isPublic = source.visibility === "public"

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <Link href="/knowledge" className="text-sm text-muted underline-offset-2 hover:underline">{t("back")}</Link>
        <SectionHeader level={1} eyebrow={source.topic ?? t(`kind_${source.kind}`)} title={source.title} description={t("detailMeta", { when })} />
        <div className={ROW_WRAP_CLASS}>
          <Badge tone={isPublic ? "success" : "neutral"}>{isPublic ? t("visPublicLong") : t("visInternalLong")}</Badge>
          <Badge isDot tone={source.status === "ready" ? "success" : source.status === "failed" ? "danger" : "warning"}>{t(`status_${source.status}`)}</Badge>
          <Text size="sm" tone="muted">{t("chunks", { count: source.chunkCount })}{source.module ? ` · ${t(`module_${source.module}`)}` : ""}</Text>
        </div>
        {source.error ? <Alert title={source.status === "failed" ? t("status_failed") : t("noVectors")} description={source.error} tone={source.status === "failed" ? "negative" : "neutral"} /> : null}
        {error !== null ? <Alert title={t("detailFailed")} description={error} tone="negative" /> : null}

        {canWrite ? (
          <div className={ROW_WRAP_CLASS}>
            <Button variant="secondary" isPending={busy === "reindex"} onPress={() => act("reindex", () => reindexKnowledge(source.id))}>{busy === "reindex" ? t("reindexing") : t("reindex")}</Button>
            <Button variant="secondary" isPending={busy === "vis"} onPress={() => act("vis", () => updateKnowledge(source.id, { visibility: isPublic ? "internal" : "public" }))}>{isPublic ? t("makeInternal") : t("makePublic")}</Button>
            <Button variant="ghost" isPending={busy === "delete"} onPress={() => { if (window.confirm(t("deleteConfirm"))) act("delete", () => deleteKnowledge(source.id), () => router.push("/knowledge")) }}>{busy === "delete" ? t("deleting") : t("delete")}</Button>
          </div>
        ) : null}

        <SurfaceCard label={t("passagesTitle")} headingLevel={2}>
          <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">{t("passagesHint")}</Text>
            {chunks.map((c) => (
              <div key={c.id} className={PASSAGE_CLASS}>
                <Text size="xs" tone="muted">#{c.ord + 1} · {c.hasEmbedding ? t("passageVector") : t("passageKeyword")} · {c.content.length}</Text>
                <div className={PASSAGE_TEXT_CLASS}>{c.content}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard label={t("contentTitle")} headingLevel={2}>
          <div className={PASSAGE_TEXT_CLASS}>{source.content.length > 6000 ? `${source.content.slice(0, 6000)} ...` : source.content}</div>
        </SurfaceCard>
      </div>
    </PageContainer>
  )
}
