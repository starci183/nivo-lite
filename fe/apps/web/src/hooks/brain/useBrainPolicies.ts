"use client"

import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryBrainPoliciesSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { POLICY_GROUPS_PLACEHOLDER, policyGroupsOf, policyNoticeOf } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeading, BrainPoliciesPageView } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainPageHeader } from "./useBrainPageHeader"
import { usePolicyDerive } from "./usePolicyDerive"
import { usePolicyDrawer } from "./usePolicyDrawer"
import { usePolicyWords } from "./usePolicyWords"

/** What the address asks of the policies tab: the heading of the page and the rule open in the drawer. */
interface BrainPoliciesInput {
    readonly heading: BrainPageHeading
    readonly policy: string | undefined
}

/** What the policies tab does besides its drawer. */
interface BrainPoliciesCommands {
    readonly selectTab: (id: string) => void
    readonly retry: () => void
    readonly open: (factId: string) => void
    readonly addDocuments: () => void
    readonly derive: () => void
}

/**
 * The policies tab of the Second Brain: the policies the AI derived from the truth graph, one row per truth under its derived group, each with
 * its source and readers, its value (and the value scheduled next) and the proposals waiting. The owner opens a rule in a drawer to
 * edit it; a manager reads. The tab holds no value of its own: every edit writes the truth graph. Above the rows it says how the derive
 * pass goes (running, or failed with a retry); a shop from before the derived layer is offered its first pass.
 */
export const useBrainPolicies = (
    input: BrainPoliciesInput,
): BrainPoliciesPageView & { readonly on: BrainPoliciesCommands } => {
    const p = useTranslations("brainPolicies")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const header = useBrainPageHeader("policies", input.heading)
    const read = useQueryBrainPoliciesSwr()
    const lenses = useBrainBoard().lenses
    const words = usePolicyWords()
    const moduleName = (module: string) => lenses.find((lens) => lens.module === module)?.name ?? module
    const slotLabels = useSlotLabels()
    const unjudged = read.data?.derivation.pendingFacts ?? 0
    const notDerivedBody = unjudged > 0 ? p("notDerivedBody", { n: unjudged }) : p("notDerivedBodyNone")
    const slot = mapSlot(slotOfSwr(read), (data) => policyGroupsOf(data.groups, words, moduleName))
    const canEdit = read.data?.canEdit ?? false
    const deriving = usePolicyDerive()
    const derivation = read.data?.derivation
    const go = (policy: string | undefined) =>
        router.replace(workspaceHref(workspaceId, brainTabHref("policies", { policy })), { scroll: false })
    const drawer = usePolicyDrawer({
        factId: canEdit ? input.policy : undefined,
        close: () => go(undefined),
        moduleName,
    })
    return {
        header: header.props,
        view: {
            slot,
            placeholder: POLICY_GROUPS_PLACEHOLDER,
            slotLabels: { ...slotLabels(p("emptyTitle")), error: p("errorTitle"), retry: p("retry") },
            notice: derivation === undefined ? null : policyNoticeOf(derivation, deriving.words),
            // The first pass is offered only to a shop the AI never read and that shows no rule yet.
            notDerived:
                derivation?.state === "not_derived" && "isEmpty" in slot
                    ? { title: p("notDerivedTitle"), body: notDerivedBody }
                    : null,
            isDerivePending: deriving.isPending,
            canEdit,
            copy: {
                listLabel: p("listLabel"),
                edit: p("edit"),
                set: p("set"),
                emptyBody: p("emptyBody"),
                emptyAction: p("emptyAction"),
                errorBody: p("errorBody"),
                retry: p("retry"),
                deriveAction: p("deriveAction"),
            },
        },
        drawer,
        on: {
            selectTab: header.on.selectTab,
            retry: () => void read.mutate(),
            open: (factId) => go(factId),
            addDocuments: () => router.push(workspaceHref(workspaceId, brainTabHref("sources"))),
            derive: deriving.derive,
        },
    }
}
