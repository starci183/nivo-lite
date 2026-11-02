"use client"
import { useContentAddPostView } from "./useContentAddPostView"
import { useContentQuickIdeaView } from "./useContentQuickIdeaView"
import { useContentPlanActionView } from "./useContentPlanActionView"
import type { ContentSelectedViewInput } from "./contentWorkbench.shared"

/** Preserves shared Calendar/List command lifetimes and the settings panel's distinct Plan mount. */
export const useContentCommandViews = (input: ContentSelectedViewInput) => {
    const managed = input.isActive && input.data?.canManage === true
    const commandInput = { ...input, isActive: managed && (input.selected === "calendar" || input.selected === "list") }
    const add = useContentAddPostView(commandInput)
    const quick = useContentQuickIdeaView(commandInput)
    const plan = useContentPlanActionView({
        ...input,
        isActive: managed,
        scope: JSON.stringify([input.scope, input.selected === "settings" ? "settings" : "panels"]),
    })
    return {
        props:
            add.props !== undefined && quick.props !== undefined && plan.props !== undefined
                ? { add: add.props, quick: quick.props, plan: plan.props }
                : undefined,
        on: { add: add.on, quick: quick.on, plan: plan.on },
    }
}
