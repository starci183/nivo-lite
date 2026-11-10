"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useMutateCreateAgentWorkflowSwr, useQueryWorkflowTemplatesSwr } from "@/hooks/swr"
import { templateDetailOf, templateRowOf } from "@/modules/agentWorkflows"
import { useGraphQLWithToast } from "@/modules/toast"
import type { DataSlot, WorkflowCreateView, WorkflowTemplatesView } from "@/modules/types"
import { useWorkflowContext } from "./useWorkflowContext"

/** The maker of a workflow from a template: the templates of the agent's kind, the one chosen and the command. */
export interface WorkflowCreateData {
    readonly view: WorkflowCreateView
    readonly templates: DataSlot<WorkflowTemplatesView>
    readonly open: () => void
    readonly close: () => void
    readonly pick: (id: string) => void
    readonly submit: () => void
}

/** What the maker needs of the tab: the agent's kind and instance, the reads to renew after a write and where the new workflow is shown. */
interface WorkflowCreateInput {
    readonly module: string
    readonly installationId: string
    readonly refresh: () => Promise<void>
    readonly onCreated: (workflowId: string) => void
}

/** The templates of the kind of agent (read once the maker opens) and the command that copies one into a new workflow of the agent. */
export const useWorkflowCreate = (input: WorkflowCreateInput): WorkflowCreateData => {
    const t = useTranslations("agentWorkflows")
    const locale = useLocale()
    const context = useWorkflowContext()
    const runGraphQL = useGraphQLWithToast()
    const [isOpen, setIsOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [pickedId, setPickedId] = useState("")
    const templates = useQueryWorkflowTemplatesSwr(isOpen ? { moduleKey: input.module, locale } : null)
    const write = useMutateCreateAgentWorkflowSwr()
    const chosen = templates.data?.find((template) => template.id === pickedId) ?? templates.data?.[0]
    const rows = useMemo(() => templates.data?.map((template) => templateRowOf(template, context)), [templates.data, context])
    const offered = isOpen ? rows : []
    return {
        view: {
            isOpen,
            selectedId: chosen?.id ?? "",
            detail: chosen === undefined ? null : templateDetailOf(chosen, context),
            isCreating,
        },
        templates: slotOfSwr<WorkflowTemplatesView>({
            data: offered === undefined ? undefined : { templates: offered },
            error: templates.error,
            isLoading: isOpen && templates.isLoading,
        }),
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        pick: setPickedId,
        submit: () => {
            if (chosen === undefined) return
            setIsCreating(true)
            void runGraphQL(
                () =>
                    write.trigger({
                        installationId: input.installationId,
                        templateId: chosen.id,
                        templateVersion: chosen.latestVersion,
                        locale,
                    }),
                { successMessage: t("created") },
            )
                .then(async (made) => {
                    if (made !== undefined) {
                        input.onCreated(made.id)
                        setIsOpen(false)
                    }
                    await input.refresh()
                })
                .finally(() => setIsCreating(false))
        },
    }
}
