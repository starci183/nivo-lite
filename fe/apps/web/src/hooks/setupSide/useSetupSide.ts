"use client"

import type { SetupKnowledgeCounts } from "@/hooks/agentSetup"
import { LOADING_SESSION, useSetupGates, useSetupKnowledge, useSetupState, useSetupVersions } from "@/hooks/agentSetup"
import { setupProgressOf } from "@/modules/setup-view"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { useSetupRequirements } from "@/hooks/setupRequirements"
import { MODULE_KEYS, isModuleKey } from "@/modules/catalog"
import { gateEntry, gateHint, gateLabel } from "@/modules/installations"
import type { ContextVersion, SetupSession } from "@/modules/installations"
import { KNOWLEDGE_ROUTES, brainTabHref } from "@/modules/routes"
import type { DataSlot, SetupSideKnowledge, SetupSideVersions, SetupSideView } from "@/modules/types"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { PLACEHOLDER_GATES, commandsOf, setupRequirementsNoticeOf, versionsViewOf } from "./setupSide.shared"

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
    const knowledgeSlot = useSetupKnowledge(moduleKey)
    const counts = knowledgeSlot.items ?? null
    const isLoading =
        slot.items === undefined ||
        catalog.slot.items === undefined ||
        counts === null ||
        versionsSlot.isLoading === true
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
    const catalogGates = catalog.modules[moduleKey]?.gates ?? []
    const gateRows =
        isLoading && catalogGates.length === 0
            ? PLACEHOLDER_GATES
            : catalogGates.map(gateViewMapper(session, locale, t))
    const view: SetupSideView = {
        unmet: setupRequirementsNoticeOf(t, unmet),
        draft: {
            title: t("draftTitle"),
            summary: session.draft.summary,
            emptyText: t("draftEmpty"),
            factsTitle: t("factsTitle"),
            facts: session.draft.facts,
        },
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
            applyLabel: applyLabelOf(t, gatesState.isApplying, progress.isReady, progress.total),
            isApplying: gatesState.isApplying,
            canApply: progress.isReady && !progress.isUnchanged,
            applyHint: progress.isReady && progress.isUnchanged ? t("applyUnchanged") : t("applyHint"),
            applyTone: gatesState.applyNote.tone,
            applyTitle: t("apply"),
            applyText:
                gatesState.applyNote.tone === "applied" ? t("applied", { version: gatesState.applyNote.version }) : "",
        },
        knowledge: knowledgeOf(t, business, counts, moduleKey),
        versions: versionsViewOf(versionsOf(t, versions, format, activeVersionId), isLoading),
    }
    const sideSlot = sideSlotOf(view, [slot, catalog.slot, knowledgeSlot, versionsSlot], isLoading)
    return {
        slot: sideSlot,
        placeholder: view,
        reload: () => {
            reload()
            catalog.reload()
            knowledgeSlot.reload()
            versionsSlot.reload()
        },
        on: commandsOf(gatesState),
    }
}

/** The side column as one slot: a failed or forbidden read shows as such, any read still in flight as loading, else the view. */
const sideSlotOf = (
    view: SetupSideView,
    reads: ReadonlyArray<DataSlot<unknown>>,
    isLoading: boolean,
): DataSlot<SetupSideView> => {
    if (reads.some((read) => read.isForbidden === true)) return { isForbidden: true }
    if (reads.some((read) => read.isError === true)) return { isError: true }
    return isLoading ? { isLoading: true } : { items: view }
}

/** The run action: applying, ready to run, or what it still needs ("Let it run (needs 8/8)"). */
const applyLabelOf = (
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
    isApplying: boolean,
    isReady: boolean,
    total: number,
): string => {
    if (isApplying) return t("applying")
    return isReady ? t("applyRun") : t("applyNeedsAll", { total })
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
    counts: SetupKnowledgeCounts | null,
    moduleKey: string,
): SetupSideKnowledge => {
    return {
        title: t("k_cardTitle"),
        businessLine: t("k_cardBusiness", { count: business }),
        publicLine: business > 0 ? t("k_cardPublic", { count: counts?.publicSources ?? 0 }) : "",
        emptyHint: counts !== null && business === 0 ? t("k_cardEmpty") : "",
        knowledgeHref: brainTabHref("sources", { module: moduleKey }),
        knowledgeLabel: t("k_cardLink"),
        nivoHref: KNOWLEDGE_ROUTES.nivo,
        nivoLabel: t("k_nivoLink"),
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
): SetupSideVersions => {
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
    }
}
