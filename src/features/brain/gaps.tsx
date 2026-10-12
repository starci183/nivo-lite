"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, Icon, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import { brain } from "@/i18n/dict/brain"
import { dismissGapAction } from "@/lib/brain/actions"
import { splitTopic, type KnowledgeGap } from "@/lib/brain/gaps-shared"
import { nivoIconSource } from "@/ui"
import { FactDrawer } from "./form"
import type { StarterPreset } from "./rail"
import type { Lens } from "./shared"

/** Props for {@link KnowledgeGapsCard}. */
export type KnowledgeGapsCardProps = {
  readonly gaps: ReadonlyArray<KnowledgeGap>
  readonly lenses: ReadonlyArray<Lens>
  /** The workspace's name: the subject of an answer when the agent could not guess one. */
  readonly business: string
  /** STATE-8: the card shows its three skeleton rows. */
  readonly isLoading?: boolean
}

/** When the question was last asked: "12/10, 14:05" (the workspace's time zone, so the server and the browser print the same). */
const whenOf = (iso: string, locale: "vi" | "en"): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso))

/** The fact form for one gap: the agent's guess of the subject and attribute, scope public (a customer asked it), the question kept in view. */
const presetOf = (g: KnowledgeGap, business: string): StarterPreset => {
  const guess = splitTopic(g.topic)
  return {
    subjectType: guess.subject ? "other" : "business",
    subjectLabel: guess.subject ?? business,
    attributeLabel: g.attributeGuess ?? guess.attribute ?? "",
    scope: "public",
    gapId: g.id,
    question: g.question,
  }
}

/**
 * "Câu khách hỏi chưa có câu trả lời": what customers asked that the brain could not answer, one row per question with how often and when it
 * was last asked. "Thêm câu trả lời" opens the fact form prefilled with the subject and attribute guess; "Bỏ qua" removes the question for good.
 * Owners and managers only: the caller renders it for them. Used on the Second Brain rail and in the chatbot workbench.
 */
export const KnowledgeGapsCard = ({ gaps, lenses, business, isLoading = false }: KnowledgeGapsCardProps) => {
  const t = useT(brain)
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [answering, setAnswering] = useState<KnowledgeGap | null>(null)

  const dismiss = (g: KnowledgeGap) => startTransition(async () => {
    setError(null)
    const r = await dismissGapAction(g.id)
    if (!r.ok) return setError(r.error)
    router.refresh()
  })

  return (
    <>
      <SurfaceListCard label={t("gapsTitle")} headingLevel={2} fact={isLoading || gaps.length ? t("gapsIntro") : t("gapsEmpty")} isLoading={isLoading}>
        {isLoading ? null : gaps.map((g) => {
          const when = whenOf(g.lastSeenAt, locale)
          return (
            <ListRow
              key={g.id}
              title={g.question}
              description={g.count > 1 ? t("gapAsked", { n: String(g.count), when }) : t("gapAskedOnce", { when })}
              badges={g.reopenedCount > 0 ? <Badge tone="warning">{t("gapReopened")}</Badge> : undefined}
              actions={(
                <>
                  <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => setAnswering(g)}>{t("gapAnswer")}</Button>
                  <Button variant="danger-soft" size="sm" isDisabled={isPending} startContent={<Icon source={nivoIconSource("trash", "chip")} usage="chip" />} onPress={() => dismiss(g)}>{t("gapDismiss")}</Button>
                </>
              )}
            />
          )
        })}
      </SurfaceListCard>
      {error ? <Alert tone="negative" title={error} /> : null}
      {answering ? (
        <FactDrawer key={answering.id} isOpen editing={null} lenses={lenses} preset={presetOf(answering, business)} onClose={() => setAnswering(null)} />
      ) : null}
    </>
  )
}
