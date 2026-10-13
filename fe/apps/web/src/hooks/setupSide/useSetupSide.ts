import { useFormatter, useLocale, useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import { MODULE_KEYS, isModuleKey } from "@/modules/catalog"
import { gateEntry, gateHint, gateLabel, gatesOf } from "@/modules/installations"
import type { ContextVersion } from "@/modules/installations"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { DataSlot } from "@/modules/types"
import type { SetupSideView } from "./setupSide.shared"
import {
    LOADING_SESSION,
    useSetupGates,
    useSetupKnowledge,
    useSetupProgress,
    useSetupState,
    useSetupVersions,
} from "@/hooks/agentSetup"
import { useSetupRequirements } from "@/hooks/setupRequirements"

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
    const { slot, reload } = useSetupState(installationId)
    const versionsSlot = useSetupVersions(installationId)
    const unmet = useSetupRequirements(moduleKey)
    const counts = useSetupKnowledge(moduleKey)
    const isLoading = slot.items === undefined
    const session = slot.items?.session ?? LOADING_SESSION
    const gatesState = useSetupGates(session.id, installationId)
    const versions = versionsSlot.items?.versions ?? NO_VERSIONS
    const activeVersionId = versionsSlot.items?.activeVersionId ?? slot.items?.instance.activeVersionId ?? null
    const progress = useSetupProgress(
        moduleKey,
        session,
        versions.find((version) => version.id === activeVersionId) ?? null,
    )
    const first = unmet[0]
    const business = counts?.business ?? 0
    const view: SetupSideView = {
        unmet:
            first === undefined
                ? null
                : {
                      title: t("requirementsTitle"),
                      body: `${t("requirementsBody")} ${unmet
                          .map((item) => (item.messageKey === "" ? item.key : t(item.messageKey)))
                          .join("; ")}.`,
                      actionLabel: t("requirementsFix"),
                      href: first.href,
                  },
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
            gates: gatesOf(moduleKey).map((gate) => {
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
            }),
            isLoading,
            editing: gatesState.editing,
            editText: gatesState.editText,
            evidencePlaceholder: t("evidencePlaceholder"),
            isGating: gatesState.isGating,
            confirmLabel: t("confirm"),
            unconfirmLabel: t("unconfirm"),
            editLabel: t("edit"),
            editSaveLabel: t("editSave"),
            editCancelLabel: t("editCancel"),
            applyLabel: gatesState.isApplying ? t("applying") : t("apply"),
            isApplying: gatesState.isApplying,
            canApply: progress.isReady && !progress.isUnchanged,
            applyHint: progress.isReady && progress.isUnchanged ? t("applyUnchanged") : t("applyHint"),
            applyTone: gatesState.applyNote.tone,
            applyTitle: t("apply"),
            applyText:
                gatesState.applyNote.tone === "applied" ? t("applied", { version: gatesState.applyNote.version }) : "",
        },
        knowledge: {
            title: t("k_cardTitle"),
            businessLine: t("k_cardBusiness", { count: business }),
            publicLine: business > 0 ? t("k_cardPublic", { count: counts?.publicSources ?? 0 }) : "",
            emptyHint: counts !== null && business === 0 ? t("k_cardEmpty") : "",
            knowledgeHref: `${KNOWLEDGE_ROUTES.library}?module=${moduleKey}`,
            knowledgeLabel: t("k_cardLink"),
            nivoHref: KNOWLEDGE_ROUTES.nivo,
            nivoLabel: t("k_nivoLink"),
            isLoading: counts === null,
        },
        versions: {
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
        },
    }
    const sideSlot: DataSlot<SetupSideView> = mapSlot(slot, () => view)
    return {
        slot: sideSlot,
        placeholder: view,
        reload,
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
