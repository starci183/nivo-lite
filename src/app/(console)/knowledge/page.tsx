import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { KnowledgeView } from "@/features/knowledge/KnowledgeView"
import { getLocale, getT } from "@/i18n/server"
import { knowledge as dict } from "@/i18n/dict/knowledge"
import { getBusinessType, listSources, listSuggestionStates, openSuggestions, topicsFrom } from "@/lib/knowledge/index"
import { KNOWLEDGE_SUGGESTIONS, suggestionTopic } from "@/lib/knowledge/shared"
import { isManagerRole } from "@/lib/members-shared"
import { listInstallations } from "@/lib/modules-core"
import { isModuleKey, MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { getSession } from "@/lib/session"

/** Tri thức doanh nghiệp: workspace knowledge shared by every agent. Everyone reads; owner and manager write. */
const Page = async ({ searchParams }: { readonly searchParams: Promise<{ module?: string }> }) => {
  const { module } = await searchParams
  try {
    // The session is cached for the request; with it known, every read below starts in ONE wave (installations, sources, suggestion states, business type).
    const session = await getSession()
    const canWrite = isManagerRole(session.member.role)
    const [locale, installations, sources, states, businessType] = await Promise.all([
      getLocale(), listInstallations(), listSources(),
      canWrite ? listSuggestionStates() : Promise.resolve<Record<string, "dismissed" | "not_applicable">>({}),
      canWrite ? getBusinessType() : Promise.resolve(null),
    ])
    const installed: Array<ModuleKey> = installations.map((i) => i.moduleKey)
    const topics = topicsFrom(sources)
    const suggestions = canWrite ? await openSuggestions(installed, locale, { states, topics, businessType }) : []
    const skipped = KNOWLEDGE_SUGGESTIONS.filter((s) => states[s.key] && s.modules.some((m) => installed.includes(m)))
      .map((s) => ({ key: s.key, topic: suggestionTopic(s, locale), state: states[s.key] as "dismissed" | "not_applicable" }))
    const initial = isModuleKey(module) ? module : "all"
    return (
      <KnowledgeView
        sources={sources} topics={topics} canWrite={canWrite} initialModule={initial} askModule={isModuleKey(module) ? module : installed[0] ?? MODULE_KEYS[0]}
        suggestions={suggestions.map((s) => ({ key: s.key, topic: s.topic, hint: s.hint, visibility: s.visibility }))} skipped={skipped}
      />
    )
  } catch (e) {
    console.error("knowledge page failed:", e instanceof Error ? e.message : e)
    const t = await getT(dict)
    return (
      <PageContainer measure="product">
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("loadFailTitle")} description={t("loadFailBody")} />
      </PageContainer>
    )
  }
}

export default Page
