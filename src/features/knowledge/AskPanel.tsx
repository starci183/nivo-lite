"use client"

import { useState, useTransition } from "react"
import { Alert, Badge, Button, Form, Input, List, ListItem, SegmentedControl, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"
import { askKnowledge } from "@/lib/knowledge/actions"
import type { Audience, Passage } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { ITEM_CLASS, LIST_CLASS, PASSAGE_CLASS, PASSAGE_TEXT_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "./classNames"

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
      <Form label={t("askTitle")} onSubmit={(_, e) => { e.preventDefault(); ask() }}>
        <div className={STACK_CLASS}>
          <Text size="sm" tone="muted">{t("askHint")}</Text>
          <SegmentedControl
            label={t("askTitle")}
            isLabelHidden
            value={audience}
            options={[{ value: "customer", label: t("askAudiencePublic") }, { value: "internal", label: t("askAudienceInternal") }]}
            onValueChange={(v) => setAudience(v === "internal" ? "internal" : "customer")}
          />
          <Select
            label={t("askModule")} variant="secondary" value={module}
            options={MODULE_KEYS.map((k) => ({ id: k, label: t(`module_${k}`) }))}
            onValueChange={(v) => setModule(MODULE_KEYS.find((k) => k === v) ?? module)}
          />
          <Input id="k-ask" name="question" label={t("askTitle")} placeholder={t("askPlaceholder")} variant="secondary" value={question} onValueChange={setQuestion} />
          <div className={ROW_WRAP_CLASS}>
            <Button variant="primary" isPending={isPending} isDisabled={!question.trim()} onPress={ask}>{isPending ? t("asking") : t("askButton")}</Button>
          </div>
          {error !== null ? <Alert title={t("askFailed")} description={error} tone="negative" /> : null}
          {results !== null && results.length === 0 ? <Text size="sm" tone="muted">{t("askEmpty")}</Text> : null}
          {results !== null && results.length > 0 ? (
            <List label={t("askTitle")} className={LIST_CLASS}>
              {results.map((p) => (
                <ListItem key={`${p.layer}-${p.id}`} className={ITEM_CLASS}>
                  <div className={PASSAGE_CLASS}>
                    <div className={ROW_WRAP_CLASS}>
                      <Badge tone="neutral">{p.layer === "nivo" ? t("layerNivo") : t("layerBusiness")}</Badge>
                      {p.layer === "business" ? <Badge tone="neutral">{p.visibility === "public" ? t("vis_public") : t("vis_internal")}</Badge> : null}
                      <Text size="xs" tone="muted">{t("score", { score: p.score.toFixed(2) })}</Text>
                    </div>
                    <Text weight="semibold" size="sm">{p.topic ? `${p.topic} · ` : ""}{p.title}</Text>
                    <div className={PASSAGE_TEXT_CLASS}><Text size="sm">{p.content.length > 700 ? `${p.content.slice(0, 700)} ...` : p.content}</Text></div>
                  </div>
                </ListItem>
              ))}
            </List>
          ) : null}
        </div>
      </Form>
    </SurfaceCard>
  )
}
