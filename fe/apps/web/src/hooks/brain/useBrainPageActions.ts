import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { useActiveWorkspace, useWorkspaceId } from "@/hooks/workspaces"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { brainPartOf, firstTabOf } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { BRAIN_PARTS, brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import type { BrainPageHeaderView } from "@/modules/types"
import { toast } from "@/modules/toast"
import { useDossierReviewCommands } from "./useDossierReviewCommands"
import { useDossierReviewSummary } from "./useDossierReviewSummary"

/** The view `useBrainPageActions` returns. */
export interface BrainPageActionsView {
    props: {
        readonly part: {
            readonly label: string
            readonly options: ReadonlyArray<{
                readonly id: string
                readonly label: string
            }>
            readonly value: string
        }
        readonly review: {
            readonly menuLabel: string
            readonly label: string
            readonly isRunning: boolean
            readonly isPending: boolean
            readonly runningLabel: string
        } | null
        readonly add: {
            readonly label: string
            readonly href: string
        } | null
    }
    on: {
        reviewAll: () => void
        setPart: (id: string) => void
    }
}

/** The part switch and authorized whole-page commands, through their actual settlement. */
export const useBrainPageActions = (tab: BrainTab): BrainPageActionsView => {
    const t = useTranslations("secondBrain")
    const review = useTranslations("dossierReview")
    const feedback = useTranslations("toast")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const member = useWorkspaceMember()
    const summary = useDossierReviewSummary()
    const commands = useDossierReviewCommands()
    const { activeWorkspaceId } = useActiveWorkspace()
    const running = useRef(new Set<string>())
    const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
    const mounted = useFeatureLifetime(true, "brain-page-review")
    const feedbackLifetime = useFeatureLifetime(true, activeWorkspaceId ?? "")
    const part = brainPartOf(tab)
    const props: BrainPageHeaderView["actions"] = {
        part: {
            label: t("partsLabel"),
            options: BRAIN_PARTS.map((one) => ({ id: one, label: t(`part_${one}`) })),
            value: part,
        },
        review: member.canWrite
            ? {
                  menuLabel: t("optionsLabel"),
                  label: review("reviewAll"),
                  isRunning: summary.isRunning,
                  isPending: commands.isPending || pending.has(activeWorkspaceId ?? ""),
                  runningLabel: review("reviewRunning"),
              }
            : null,
        add:
            member.canWrite && part === "internal" && tab !== "sources"
                ? { label: t("addDocuments"), href: workspaceHref(workspaceId, brainTabHref("sources")) }
                : null,
    }
    return {
        props,
        on: {
            reviewAll: () => {
                if (
                    !member.canWrite ||
                    activeWorkspaceId === undefined ||
                    summary.isRunning ||
                    running.current.has(activeWorkspaceId)
                )
                    return
                const isMounted = mounted.capture()
                const ownsFeedback = feedbackLifetime.capture()
                running.current.add(activeWorkspaceId)
                setPending((previous) => new Set(previous).add(activeWorkspaceId))
                const settle = () => {
                    running.current.delete(activeWorkspaceId)
                    if (isMounted())
                        setPending((previous) => {
                            const next = new Set(previous)
                            next.delete(activeWorkspaceId)
                            return next
                        })
                }
                commands.requestReview(null).then(settle, () => {
                    settle()
                    if (ownsFeedback()) toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
                })
            },
            setPart: (id: string) => {
                const next = BRAIN_PARTS.find((one) => one === id)
                if (next !== undefined) router.push(workspaceHref(workspaceId, brainTabHref(firstTabOf(next))))
            },
        },
    }
}
