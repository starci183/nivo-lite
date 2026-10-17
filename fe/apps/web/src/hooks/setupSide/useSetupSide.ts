"use client"

import { LOADING_SESSION, useSetupGates, useSetupKnowledge, useSetupState, useSetupVersions } from "@/hooks/agentSetup"
import { setupProgressOf } from "@/modules/setup-view"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { useSetupRequirements } from "@/hooks/setupRequirements"
import { mapSlot } from "@/hooks/slot"
import { MODULE_KEYS, isModuleKey } from "@/modules/catalog"
import { gateEntry, gateHint, gateLabel } from "@/modules/installations"
import type { ContextVersion, SetupSession } from "@/modules/installations"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { DataSlot } from "@/modules/types"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { setupRequirementsNoticeOf } from "./setupSide.shared"
import type { SetupSideView } from "./setupSide.shared"

const GATE_TONE = { missing: "neutral", proposed: "warning", confirmed: "success" } as const
const NO_VERSIONS: ReadonlyArray<ContextVersion> = []

/**
 * The side column of the Setup tab: the draft, the gate checklist, the knowledge the module runs on and the versions applied, as one
 * view with the commands of the checklist. The module is the type of the url; it reads as the first one if it is unknown.
 */
export const useSetupSide = (module: string, installationId: string) => {
    const t = useTranslations("moduleSetup")
    const locale = useLocale() === "en" ? "en" : "vi"
    const format = useFormatter()
    const moduleKey = isModuleKey(module) ? module : MODULE_KEYS[0]
    const catalog = useModuleCatalog()
    const { slot, reload } = useSetupState(installationId)
    const versionsSlot = useSetupVersions(installationId)
    const unmet = useSetupRequirements(moduleKey)
    const counts = useSetupKnowledge(moduleKey)
    const isLoading = slot.items === undefined || catalog.slot.items === undefined
    const session = slot.items?.session ?? LOADING_SESSION
    const gatesState = useSetupGates(session.id, installationId)
    const versions = versionsSlot.items?.versions ?? NO_VERSIONS
    const activeVersionId = versionsSlot.items?.activeVersionId ?? slot.items?.instance.activeVersionId ?? null
    const progress = setupProgressOf(
        moduleKey,
        session,
        versions.find((version) => version.id === activeVersionId) ?? null,
    )
    const business = counts?.business ?? 0
    const view: SetupSideView = {
        unmet: setupRequirementsNoticeOf(t, unmet),
        draft: {
            title: t("draftTitle"),
            summary: session.draft.summary,
            emptyText: t("draftEmpty"),
            factsTitle: t("factsTitle"),
            facts: session.draft.facts,
            isLoading,
        },
        gates: {
            title: t("gatesTitle"),
            progressLabel: t("gatesProgress", { done: progress.confirmed, total: progress.total }),
            confirmed: progress.confirmed,
            total: progress.total,
            gates: (catalog.modules[moduleKey]?.gates ?? []).map(gateViewMapper(session, locale, t)),
            isLoading,
            editing: gatesState.editing,
            editText: gatesState.editText,
            evidencePlaceholder: t("evidencePlaceholder"),
            isGating: gatesState.isGating,
            ...gatesLabelsOf(t),
            applyLabel: gatesState.isApplying ? t("applying") : t("apply"),
            isApplying: gatesState.isApplying,
            canApply: progress.isReady && !progress.isUnchanged,
            applyHint: progress.isReady && progress.isUnchanged ? t("applyUnchanged") : t("applyHint"),
            applyTone: gatesState.applyNote.tone,
            applyTitle: t("apply"),
            applyText:
                gatesState.applyNote.tone === "applied" ? t("applied", { version: gatesState.applyNote.version }) : "",
        },
        knowledge: knowledgeOf(t, business, counts, moduleKey),
        versions: versionsOf(t, versions, format, activeVersionId, versionsSlot),
    }
    const sideSlot: DataSlot<SetupSideView> =
        slot.items === undefined ? mapSlot(slot, () => view) : mapSlot(catalog.slot, () => view)
    return {
        slot: sideSlot,
        placeholder: view,
        reload: () => {
            reload()
            catalog.reload()
        },
        on: {
            editText: gatesState.setEditText,
            gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) =>
                void gatesState.gate(gateKey, { action, evidence }),
            startEdit: gatesState.startEdit,
            stopEdit: gatesState.stopEdit,
            apply: () => void gatesState.apply(),
        },
    }
}

/** Resolves the gates labels for the current locale. */
const gatesLabelsOf = (t: ReturnType<typeof useTranslations<"moduleSetup">>) => ({
    confirmLabel: t("confirm"),
    unconfirmLabel: t("unconfirm"),
    editLabel: t("edit"),
    editSaveLabel: t("editSave"),
    editCancelLabel: t("editCancel"),
})

const knowledgeOf = (
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
    business: number,
    counts: ReturnType<typeof useSetupKnowledge>,
    moduleKey: string,
): import("@/hooks/setupSide/setupSide.shared").SetupSideKnowledge => {
    return {
        title: t("k_cardTitle"),
        businessLine: t("k_cardBusiness", { count: business }),
        publicLine: business > 0 ? t("k_cardPublic", { count: counts?.publicSources ?? 0 }) : "",
        emptyHint: counts !== null && business === 0 ? t("k_cardEmpty") : "",
        knowledgeHref: `${KNOWLEDGE_ROUTES.library}?module=${moduleKey}`,
        knowledgeLabel: t("k_cardLink"),
        nivoHref: KNOWLEDGE_ROUTES.nivo,
        nivoLabel: t("k_nivoLink"),
        isLoading: counts === null,
    }
}

const gateViewMapper = (
    session: SetupSession,
    locale: "vi" | "en",
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
): ((
    gate: NonNullable<
        NonNullable<ReturnType<typeof useModuleCatalog>["modules"][(typeof MODULE_KEYS)[number]]>["gates"]
    >[number],
) => SetupSideView["gates"]["gates"][number]) => {
    return (gate) => {
        const entry = gateEntry(session.gateEvidence, gate.key)
        return {
            key: gate.key,
            label: gateLabel(gate, locale),
            hint: gateHint(gate, locale),
            status: entry.status,
            statusLabel: t(`gate_${entry.status}`),
            statusTone: GATE_TONE[entry.status],
            evidence: entry.evidence,
        }
    }
}

const versionsOf = (
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
    versions: readonly ContextVersion[],
    format: ReturnType<typeof useFormatter>,
    activeVersionId: string | null,
    versionsSlot: ReturnType<typeof useSetupVersions>,
): import("@/hooks/setupSide/setupSide.shared").SetupSideVersions => {
    return {
        title: t("versionsTitle"),
        emptyText: t("versionsEmpty"),
        inUseLabel: t("inUse"),
        versions: versions.map((version) => ({
            id: version.id,
            line: t("versionLine", { version: version.version }),
            detail: `${t("versionBy", {
                who: version.appliedBy,
                when: format.dateTime(new Date(version.appliedAt), { dateStyle: "medium", timeStyle: "short" }),
            })} · ${t("versionFacts", { count: version.snapshot.facts.length })}`,
            isActive: version.id === activeVersionId,
        })),
        isLoading: versionsSlot.items === undefined,
    }
}
