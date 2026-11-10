"use client"

import { LOADING_SESSION, useSetupGates, useSetupState, useSetupVersions } from "@/hooks/agentSetup"
import { setupProgressOf } from "@/modules/setup-view"
import { slotOfReads } from "@/hooks/slot"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { useSetupRequirements } from "@/hooks/setupRequirements"
import { MODULE_KEYS, isModuleKey } from "@/modules/catalog"
import type { ContextVersion } from "@/modules/installations"
import type { DataSlot, SetupSideView } from "@/modules/types"
import { useLocale, useTranslations } from "next-intl"
import {
    PLACEHOLDER_GATES,
    commandsOf,
    gateViewMapper,
    setupRequirementsNoticeOf,
} from "./setupSide.shared"

import type { Dispatch, SetStateAction } from "react"

const NO_VERSIONS: ReadonlyArray<ContextVersion> = []

type UseSetupSideResult = {
    slot: DataSlot<SetupSideView>
    placeholder: SetupSideView
    reload: () => void
    on: {
        editText: Dispatch<SetStateAction<string>>
        gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => undefined
        startEdit: (gateKey: string, evidence: string) => void
        stopEdit: () => void
        apply: () => undefined
    }
    setup: {
        isReady: boolean
        isChanged: boolean
        missing: number
        isApplying: boolean
        apply: () => Promise<void>
    }
}

/**
 * The side column of the Setup tab: the gate checklist (what the agent understood), as one view with the commands of the
 * checklist (the versions come from the graph read). The module is the type of the url; it reads as the first one if it is unknown.
 */
export const useSetupSide = (module: string, installationId: string): UseSetupSideResult => {
    const t = useTranslations("moduleSetup")
    const locale = useLocale() === "en" ? "en" : "vi"
    const moduleKey = isModuleKey(module) ? module : MODULE_KEYS[0]
    const catalog = useModuleCatalog()
    const state = useSetupState(installationId)
    const { slot, reload } = state
    const versionsSlot = useSetupVersions(installationId)
    const unmet = useSetupRequirements(moduleKey)
    const reads = [state.read, catalog.read, versionsSlot.read]
    const isLoading = reads.some((read) => read.data === undefined && read.isLoading)
    const session = ("items" in slot ? slot.items : undefined)?.session ?? LOADING_SESSION
    const gatesState = useSetupGates(session.id, installationId)
    const versions = ("items" in versionsSlot ? versionsSlot.items : undefined)?.versions ?? NO_VERSIONS
    const activeVersionId =
        ("items" in versionsSlot ? versionsSlot.items : undefined)?.activeVersionId ??
        ("items" in slot ? slot.items : undefined)?.instance.activeVersionId ??
        null
    const progress = setupProgressOf(
        moduleKey,
        session,
        versions.find((version) => version.id === activeVersionId) ?? null,
    )
    const catalogGates = catalog.modules[moduleKey]?.gates ?? []
    const gateRows =
        isLoading && catalogGates.length === 0
            ? PLACEHOLDER_GATES
            : catalogGates.map(gateViewMapper(session, locale, t))
    const view: SetupSideView = {
        unmet: setupRequirementsNoticeOf(t, unmet),
        gates: {
            title: t("gatesTitle"),
            progressLabel: t("gatesProgress", { done: progress.confirmed, total: progress.total }),
            confirmed: progress.confirmed,
            total: progress.total,
            gates: gateRows,
            editing: gatesState.editing,
            editText: gatesState.editText,
            evidencePlaceholder: t("evidencePlaceholder"),
            isGating: gatesState.isGating,
            ...gatesLabelsOf(t),
            isApplying: gatesState.isApplying,
            canApply: progress.isReady && !progress.isUnchanged,
            applyTone: gatesState.applyNote.tone,
            applyTitle: t("apply"),
            applyText:
                gatesState.applyNote.tone === "applied" ? t("applied", { version: gatesState.applyNote.version }) : "",
        },
    }
    const sideSlot = slotOfReads(reads, () => view)
    return {
        slot: sideSlot,
        placeholder: view,
        reload: (): void => {
            reload()
            catalog.reload()
            versionsSlot.reload()
        },
        on: commandsOf(gatesState),
        setup: setupOf(progress, gatesState, isLoading),
    }
}

/** The checklist as the one publish action of the map needs it; while it is read it counts as settled. */
const setupOf = (
    progress: ReturnType<typeof setupProgressOf>,
    gatesState: ReturnType<typeof useSetupGates>,
    isLoading: boolean,
) => ({
    isReady: isLoading || progress.isReady,
    isChanged: !isLoading && !progress.isUnchanged,
    missing: progress.total - progress.confirmed,
    isApplying: gatesState.isApplying,
    apply: gatesState.apply,
})

/** Resolves the gates labels for the current locale. */
const gatesLabelsOf = (t: ReturnType<typeof useTranslations<"moduleSetup">>) => ({
    confirmLabel: t("confirm"),
    editLabel: t("edit"),
    editSaveLabel: t("editSave"),
    editCancelLabel: t("editCancel"),
    understoodLabel: t("understood"),
})
