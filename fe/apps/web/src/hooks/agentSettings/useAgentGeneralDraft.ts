"use client"

import { useState } from "react"
import { AGENT_NAME_MAX, AGENT_NAME_MIN, HOLDING_MAX, type AgentInstallationView } from "./agentSettings.shared"
import { useAgentRights } from "./useAgentRights"
import { useSaveAgentName } from "./useSaveAgentName"
import { useSaveReply } from "./useSaveReply"
import { useWorkingHours } from "./useWorkingHours"
import { sameWeek, type WeekSlots } from "@/modules/workingHours"

/** The fields of the general form as the owner is editing them, and what pressing the one save button would do. */
export interface AgentGeneralDraftView {
    readonly name: string
    readonly week: WeekSlots
    readonly afterHours: boolean
    readonly holding: string
    readonly hasReply: boolean
    readonly isDisabled: boolean
    readonly isPending: boolean
    readonly isDirty: boolean
    readonly canSave: boolean
    readonly setName: (value: string) => void
    readonly setWeek: (week: WeekSlots) => void
    readonly setAfterHours: (on: boolean) => void
    readonly setHolding: (value: string) => void
    readonly cancel: () => void
    readonly save: () => Promise<void>
}

/** The drafts: null means the field shows what is saved. */
interface Drafts {
    readonly name: string | null
    readonly week: WeekSlots | null
    readonly afterHours: boolean | null
    readonly holding: string | null
}

const CLEAN: Drafts = { name: null, week: null, afterHours: null, holding: null }

/**
 * One draft for the name, the working hours and the holding message of an agent, and one save that sends each field that changed. A
 * field that fails stays in the draft (the failure was already toasted); the ones that went through leave it.
 */
export const useAgentGeneralDraft = (
    installationId: string,
    agent: AgentInstallationView | undefined,
    hasReplyLimits: boolean,
): AgentGeneralDraftView => {
    const { canEdit } = useAgentRights()
    const { save: saveName, isSaving: isSavingName } = useSaveAgentName(installationId)
    const { holding: saveHolding, isSaving: isSavingReply } = useSaveReply(installationId)
    const { saved, save: saveHours, isSaving: isSavingHours } = useWorkingHours(installationId, agent?.workingHours ?? null)
    const [drafts, setDrafts] = useState<Drafts>(CLEAN)
    const patch = (change: Partial<Drafts>): void => setDrafts((current) => ({ ...current, ...change }))
    const savedName = agent?.name ?? ""
    const savedHolding = agent?.holdingMessage ?? ""
    const name = drafts.name ?? savedName
    const week = drafts.week ?? saved.week
    const afterHours = drafts.afterHours ?? saved.afterHours
    const holding = drafts.holding ?? savedHolding
    const nameChanged = drafts.name !== null && name.trim() !== savedName
    const hoursChanged =
        (drafts.week !== null && !sameWeek(week, saved.week)) ||
        (drafts.afterHours !== null && drafts.afterHours !== saved.afterHours)
    const holdingChanged = hasReplyLimits && drafts.holding !== null && holding.trim() !== savedHolding.trim()
    const isDirty = nameChanged || hoursChanged || holdingChanged
    const canSave = canEdit && isDirty && (!nameChanged || name.trim().length >= AGENT_NAME_MIN)
    const save = async (): Promise<void> => {
        if (!canSave) return
        if (nameChanged && (await saveName(name))) patch({ name: null })
        if (holdingChanged && (await saveHolding(holding))) patch({ holding: null })
        if (hoursChanged && (await saveHours({ week, afterHours }))) patch({ week: null, afterHours: null })
    }
    return {
        name,
        week,
        afterHours,
        holding,
        // The reply limits rest as themselves while the agent is read (STATE-8), so the form keeps its height when the data lands.
        hasReply: hasReplyLimits,
        isDisabled: !canEdit || isSavingName || isSavingReply || isSavingHours,
        isPending: isSavingName || isSavingReply || isSavingHours,
        isDirty,
        canSave,
        setName: (value) => patch({ name: value.slice(0, AGENT_NAME_MAX) }),
        setWeek: (value) => patch({ week: value }),
        setAfterHours: (value) => patch({ afterHours: value }),
        setHolding: (value) => patch({ holding: value.slice(0, HOLDING_MAX) }),
        cancel: () => setDrafts(CLEAN),
        save,
    }
}
