"use client"

import { Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { CodeBlock } from "@/features/connections/CodeBlock"
import { useT } from "@/i18n/client"
import { developers as dict } from "@/i18n/dict/developers"
import { EXAMPLE_CLASS, STACK_CLASS } from "./classNames"
import { buildExamples } from "./examples"

/** "Hướng dẫn nhanh": base address, auth, limits, then copyable curl and n8n examples. */
export const QuickStart = ({ base }: { readonly base: string }) => {
  const t = useT(dict)
  const ex = buildExamples(base)
  const block = (title: string, code: string, note?: string) => (
    <div className={EXAMPLE_CLASS}>
      <Heading level={3}>{title}</Heading>
      {note ? <Text size="sm" tone="muted">{note}</Text> : null}
      <CodeBlock code={code} />
    </div>
  )
  return (
    <SurfaceCard label={t("guideTitle")} headingLevel={2}>
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">{t("guideIntro", { base })}</Text>
        {block(t("header"), ex.header)}
        {block(t("leadsPost"), ex.leadsPost, t("leadsPostNote"))}
        {block(t("messagesPost"), ex.messagesPost, t("messagesPostNote"))}
        {block(t("knowledgePost"), ex.knowledgePost, t("knowledgePostNote"))}
        {block(t("leadsGet"), ex.leadsGet, t("pullNote"))}
        {block(t("eventsGet"), ex.eventsGet)}
        <div className={EXAMPLE_CLASS}>
          <Heading level={3}>{t("n8nTitle")}</Heading>
          <Text size="sm" tone="muted">{t("n8nSteps")}</Text>
          <CodeBlock code={ex.n8nUrl} />
          <CodeBlock code={ex.n8nBody} />
        </div>
      </div>
    </SurfaceCard>
  )
}
