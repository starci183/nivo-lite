"use client"

import { useState, useTransition } from "react"
import { Alert, Badge, Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"
import { askKnowledge } from "@/lib/knowledge/actions"
import type { Audience, Passage } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { FIELD_CLASS, LABEL_CLASS, PASSAGE_CLASS, PASSAGE_TEXT_CLASS, ROW_WRAP_CLASS, STACK_CLASS, TAB_ROW_CLASS } from "./classNames"

/** "Thử hỏi": type a question and see which passages an agent would retrieve, labelled by layer. */
export const AskPanel = ({ initialModule }: { readonly initialModule: ModuleKey }) => {
  const t = useT(knowledge)
  const [question, setQuestion] = useState("")
  const [module, setModule] = useState<ModuleKey>(initialModule)
  const [audience, setAudience] = useState<Audience>("customer")
  const [results, setResults] = useState<ReadonlyArray<Passage> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const ask = () => {
    if (!question.trim()) return
    setError(null)
    start(async () => {
      const r = await askKnowledge(question, module, audience)
      if (!r.ok) { setError(r.error); return }
      setResults(r.data)
    })
  }

  return (
    <SurfaceCard label={t("askTitle")} headingLevel={2}>
      <form className={STACK_CLASS} onSubmit={(e) => { e.preventDefault(); ask() }}>
        <Text size="sm" tone="muted">{t("askHint")}</Text>
        <div className={TAB_ROW_CLASS}>
          <Button variant={audience === "customer" ? "primary" : "secondary"} size="sm" onPress={() => setAudience("customer")}>{t("askAudiencePublic")}</Button>
          <Button variant={audience === "internal" ? "primary" : "secondary"} size="sm" onPress={() => setAudience("internal")}>{t("askAudienceInternal")}</Button>
        </div>
        <label className={LABEL_CLASS}>
          {t("askModule")}
          <select className={FIELD_CLASS} value={module} onChange={(e) => setModule(e.target.value as ModuleKey)}>
            {MODULE_KEYS.map((k) => <option key={k} value={k}>{t(`module_${k}`)}</option>)}
          </select>
        </label>
        <Input id="k-ask" name="question" label={t("askTitle")} placeholder={t("askPlaceholder")} variant="secondary" value={question} onValueChange={setQuestion} />
        <div className={ROW_WRAP_CLASS}>
          <Button variant="primary" isPending={isPending} isDisabled={!question.trim()} onPress={ask}>{isPending ? t("asking") : t("askButton")}</Button>
        </div>
        {error !== null ? <Alert title={t("askFailed")} description={error} tone="negative" /> : null}
        {results !== null && results.length === 0 ? <Text size="sm" tone="muted">{t("askEmpty")}</Text> : null}
        {results?.map((p) => (
          <div key={`${p.layer}-${p.id}`} className={PASSAGE_CLASS}>
            <div className={ROW_WRAP_CLASS}>
              <Badge isDot tone={p.layer === "nivo" ? "accent" : "success"}>{p.layer === "nivo" ? t("layerNivo") : t("layerBusiness")}</Badge>
              {p.layer === "business" ? <Badge tone={p.visibility === "public" ? "success" : "neutral"}>{p.visibility === "public" ? t("vis_public") : t("vis_internal")}</Badge> : null}
              <Text size="xs" tone="muted">{t("score", { score: p.score.toFixed(2) })}</Text>
            </div>
            <Text weight="semibold" size="sm">{p.topic ? `${p.topic} · ` : ""}{p.title}</Text>
            <div className={PASSAGE_TEXT_CLASS}>{p.content.length > 700 ? `${p.content.slice(0, 700)} ...` : p.content}</div>
          </div>
        ))}
      </form>
    </SurfaceCard>
  )
}
