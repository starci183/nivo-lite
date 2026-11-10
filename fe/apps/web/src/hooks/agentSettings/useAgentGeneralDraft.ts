"use client"

import { useState } from "react"
import { AGENT_NAME_MAX, AGENT_NAME_MIN, HOLDING_MAX, REPLY_TIMEOUT_MAX, REPLY_TIMEOUT_MIN } from "./agentSettings.shared"
import type { AgentInstallationView } from "./agentSettings.shared"
import { useAgentRights } from "./useAgentRights"
import { useSaveAgentName } from "./useSaveAgentName"
import { useSaveReply } from "./useSaveReply"
import { useWorkingHours } from "./useWorkingHours"
import { sameWeek } from "@/modules/workingHours"
import type { WeekSlots } from "@/modules/workingHours"

const TIMEOUT_DIGITS = 3

/** The fields of the general form as the owner is editing them, and what pressing the one save button would do. */
export interface AgentGeneralDraftView {
    readonly name: string
    readonly week: WeekSlots
    readonly afterHours: boolean
    readonly timeout: string
    readonly holding: string
    readonly hasReply: boolean
    readonly isDisabled: boolean
    readonly isPending: boolean
    readonly isDirty: boolean
    readonly canSave: boolean
    readonly setName: (value: string) => void
    readonly setWeek: (week: WeekSlots) => void
    readonly setAfterHours: (on: boolean) => void
    readonly setTimeout: (value: string) => void
    readonly setHolding: (value: string) => void
    readonly cancel: () => void
    readonly save: () => Promise<void>
}

/** The drafts: null means the field shows what is saved. */
interface Drafts {
    readonly name: string | null
    readonly week: WeekSlots | null
    readonly afterHours: boolean | null
    readonly timeout: string | null
    readonly holding: string | null
}

const CLEAN: Drafts = { name: null, week: null, afterHours: null, timeout: null, holding: null }

/**
 * One draft for the name, the working hours and the reply limits of an agent, and one save that sends each field that changed. A
 * field that fails stays in the draft (the failure was already toasted); the ones that went through leave it.
 */
export const useAgentGeneralDraft = (
    installationId: string,
    agent: AgentInstallationView | undefined,
    hasReplyLimits: boolean,
): AgentGeneralDraftView => {
    const { canEdit } = useAgentRights()
    const { save: saveName, isSaving: isSavingName } = useSaveAgentName(installationId)
    const { timeout: saveTimeout, holding: saveHolding, isSaving: isSavingReply } = useSaveReply(installationId)
    const { saved, save: saveHours, isSaving: isSavingHours } = useWorkingHours(installationId, agent?.workingHours ?? null)
    const [drafts, setDrafts] = useState<Drafts>(CLEAN)
    const patch = (change: Partial<Drafts>): void => setDrafts((current) => ({ ...current, ...change }))
    const hasReply = hasReplyLimits && agent !== undefined
    const savedName = agent?.name ?? ""
    const savedTimeout = agent?.timeoutSec ?? 0
    const savedHolding = agent?.holdingMessage ?? ""
    const name = drafts.name ?? savedName
    const week = drafts.week ?? saved.week
    const afterHours = drafts.afterHours ?? saved.afterHours
    const timeoutText = drafts.timeout ?? String(savedTimeout)
    const holding = drafts.holding ?? savedHolding
    const timeout = Number(timeoutText)
    const nameChanged = drafts.name !== null && name.trim() !== savedName
    const hoursChanged =
        (drafts.week !== null && !sameWeek(week, saved.week)) ||
        (drafts.afterHours !== null && drafts.afterHours !== saved.afterHours)
    const timeoutChanged = hasReply && drafts.timeout !== null && timeout !== savedTimeout
    const holdingChanged = hasReply && drafts.holding !== null && holding.trim() !== savedHolding.trim()
    const timeoutValid = Number.isInteger(timeout) && timeout >= REPLY_TIMEOUT_MIN && timeout <= REPLY_TIMEOUT_MAX
    const isDirty = nameChanged || hoursChanged || timeoutChanged || holdingChanged
    const canSave =
        canEdit && isDirty && (!nameChanged || name.trim().length >= AGENT_NAME_MIN) && (!timeoutChanged || timeoutValid)
    const save = async (): Promise<void> => {
        if (!canSave) return
        if (nameChanged && (await saveName(name))) patch({ name: null })
        if (timeoutChanged && (await saveTimeout(timeout))) patch({ timeout: null })
        if (holdingChanged && (await saveHolding(holding))) patch({ holding: null })
        if (hoursChanged && (await saveHours({ week, afterHours }))) patch({ week: null, afterHours: null })
    }
    return {
        name,
        week,
        afterHours,
        timeout: timeoutText,
        holding,
        hasReply,
        isDisabled: !canEdit || isSavingName || isSavingReply || isSavingHours,
        isPending: isSavingName || isSavingReply || isSavingHours,
        isDirty,
        canSave,
        setName: (value) => patch({ name: value.slice(0, AGENT_NAME_MAX) }),
        setWeek: (value) => patch({ week: value }),
        setAfterHours: (value) => patch({ afterHours: value }),
        setTimeout: (value) => patch({ timeout: value.replace(/\D/gu, "").slice(0, TIMEOUT_DIGITS) }),
        setHolding: (value) => patch({ holding: value.slice(0, HOLDING_MAX) }),
        cancel: () => setDrafts(CLEAN),
        save,
    }
}
