import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { ideasFor, topicsOf } from "@/modules/documents"
import type { IdeaDecision } from "@/modules/types"
import { useKnowledgeSources } from "./useKnowledgeSources"
import { useKnowledgeSuggestions } from "./useKnowledgeSuggestions"
import { useModuleInstallations } from "./useModuleInstallations"
import { useWorkspaceMember } from "./useWorkspaceMember"

/** One idea, by the key its words are stored under. */
interface IdeaView {
    readonly key: string
    readonly state?: IdeaDecision
}

/** What the suggestions block draws. */
interface KnowledgeIdeas {
    /** Owners and managers see the ideas; everyone else sees nothing. */
    readonly canWrite: boolean
    readonly open: ReadonlyArray<IdeaView>
    readonly skipped: ReadonlyArray<IdeaView>
    readonly isLoading: boolean
}

/**
 * The ideas of documents worth adding for the workspace: the ones that fit its installed agents and business type, minus the
 * ones the owner decided about and the ones already covered by a document topic.
 */
export const useKnowledgeIdeas = (): KnowledgeIdeas => {
    const t = useTranslations("knowledge")
    const member = useWorkspaceMember()
    const { sources, isLoading: sourcesLoading } = useKnowledgeSources()
    const { installations, isLoading: installationsLoading } = useModuleInstallations()
    const { context, isLoading: contextLoading } = useKnowledgeSuggestions(member.canWrite)
    const isLoading =
        member.isLoading ||
        sourcesLoading ||
        installationsLoading ||
        (member.canWrite && contextLoading) ||
        sources === undefined ||
        installations === undefined
    const { open, skipped } = useMemo(() => {
        if (!member.canWrite) return { open: [], skipped: [] }
        const decided = context?.states ?? new Map<string, IdeaDecision>()
        const used = new Set(topicsOf(sources ?? []).map((topic) => topic.toLowerCase()))
        const installed = (installations ?? []).map((one) => one.moduleKey)
        const fitting = ideasFor(installed, context === undefined ? null : context.businessType)
        return {
            open: fitting
                .filter((one) => !decided.has(one.key) && !used.has(t(`suggest_${one.key}_topic`).toLowerCase()))
                .map((one) => ({ key: one.key })),
            skipped: fitting.flatMap((one) => {
                const state = decided.get(one.key)
                return state === undefined ? [] : [{ key: one.key, state }]
            }),
        }
    }, [member.canWrite, context, sources, installations, t])
    return { canWrite: member.canWrite, open, skipped, isLoading }
}
