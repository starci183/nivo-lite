import { unstable_rethrow } from "next/navigation"
import { after } from "next/server"
import { KnowledgeView } from "@/features/knowledge/KnowledgeView"
import { getLocale } from "@/i18n/server"
import { drainBrainWork } from "@/lib/brain/doc-facts"
import { reembedStale } from "@/lib/knowledge/reembed"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { getBusinessType, listSources, listSuggestionStates, openSuggestions, topicsFrom } from "@/lib/knowledge/index"
import { KNOWLEDGE_SUGGESTIONS, suggestionTopic } from "@/lib/knowledge/shared"
import { isManagerRole } from "@/lib/members-shared"
import { listInstallations } from "@/lib/modules-core"
import { isModuleKey, MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { moduleName } from "@/lib/module-registry"
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
    // Re-embedding after a model change and reading the facts of queued documents run after the response, bounded.
    if (canWrite) after(async () => { await reembedStale(supabaseAdmin(), session.workspace.id); await drainBrainWork(session.workspace.id) })
    const installed: Array<ModuleKey> = installations.map((i) => i.moduleKey)
    const topics = topicsFrom(sources)
    const suggestions = canWrite ? await openSuggestions(installed, locale, { states, topics, businessType }) : []
    const skipped = KNOWLEDGE_SUGGESTIONS.filter((s) => states[s.key] && s.modules.some((m) => installed.includes(m)))
      .map((s) => ({ key: s.key, topic: suggestionTopic(s, locale), state: states[s.key] as "dismissed" | "not_applicable" }))
    const initial = isModuleKey(module) ? module : "all"
    // Types with several agent instances (one Chatbot per branch or Fanpage): a document can be kept for one of them.
    const multi = installations.filter((i) => i.isMulti && installations.filter((j) => j.moduleKey === i.moduleKey).length > 1)
    const instances = multi.map((i) => ({ id: i.id, moduleKey: i.moduleKey, label: `${moduleName(i.moduleKey, locale)} – ${i.name}` }))
    return (
      <KnowledgeView
        sources={sources} topics={topics} canWrite={canWrite} workspaceId={session.workspace.id} initialModule={initial} instances={instances} askModule={isModuleKey(module) ? module : installed[0] ?? MODULE_KEYS[0]}
        suggestions={suggestions.map((s) => ({ key: s.key, topic: s.topic, hint: s.hint, visibility: s.visibility }))} skipped={skipped}
      />
    )
  } catch (e) {
    unstable_rethrow(e) // Next signals (redirect, notFound, dynamic usage) pass through unlogged
    // STATE-8 case-4: log it, then let the route's error.tsx keep the chrome and show the failure.
    console.error("knowledge page failed:", e instanceof Error ? e.message : e)
    throw e
  }
}

export default Page
