import type { SetupKnowledgeCounts, useSetupGates } from "@/hooks/agentSetup"
import type { useModuleCatalog } from "@/hooks/moduleCatalog"
import type { MODULE_KEYS } from "@/modules/catalog"
import { gateEntry, gateHint, gateLabel, type ContextVersion, type SetupSession } from "@/modules/installations"
import { brainTabHref, KNOWLEDGE_ROUTES, workspaceHref } from "@/modules/routes"
import type { useSetupRequirements } from "@/hooks/setupRequirements"
import type { SetupSideKnowledge, SetupSideNotice, SetupSideVersions, SetupSideView } from "@/modules/types"
import type { useFormatter, useTranslations } from "next-intl"

import type { Dispatch, SetStateAction } from "react"

const GATE_TONE = { missing: "neutral", proposed: "warning", confirmed: "success" } as const

/** The notice that explains which requirements block setup. */
export const setupRequirementsNoticeOf = (
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
    unmet: ReturnType<typeof useSetupRequirements>,
): SetupSideNotice | null => {
    const first = unmet[0]
    return first === undefined
        ? null
        : {
              title: t("requirementsTitle"),
              body: `${t("requirementsBody")} ${unmet
                  .map((item) => (item.messageKey === "" ? item.key : t(item.messageKey)))
                  .join("; ")}.`,
              actionLabel: t("requirementsFix"),
              href: first.href,
          }
}

/** How many items the checklist of an agent holds: the rows its skeleton draws before the catalogue says which. */
const PLACEHOLDER_GATE_COUNT = 8

/** The skeleton rows of the checklist while the catalogue is read. */
export const PLACEHOLDER_GATES: SetupSideView["gates"]["gates"] = Array.from(
    { length: PLACEHOLDER_GATE_COUNT },
    (_, index) => ({
        key: `placeholder-${String(index)}`,
        label: "-",
        hint: "-",
        status: "missing",
        statusLabel: "-",
        statusTone: "neutral",
        evidence: "",
    }),
)

/** The one skeleton row of the versions while they are read. */
const PLACEHOLDER_VERSIONS: SetupSideVersions["versions"] = [
    { id: "placeholder", line: "-", detail: "-", isActive: false },
]

/** The versions as drawn: a skeleton row while the side is read and none are in yet, else as they are. */
export const versionsViewOf = (versions: SetupSideVersions, isLoading: boolean): SetupSideVersions =>
    isLoading && versions.versions.length === 0 ? { ...versions, versions: PLACEHOLDER_VERSIONS } : versions

type CommandsOfResult = {
    editText: Dispatch<SetStateAction<string>>
    gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => undefined
    startEdit: (gateKey: string, evidence: string) => void
    stopEdit: () => void
    apply: () => undefined
}

/** The commands of the checklist: edit, confirm, reopen and apply. */
export const commandsOf = (gatesState: ReturnType<typeof useSetupGates>): CommandsOfResult => ({
    editText: gatesState.setEditText,
    gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string): undefined =>
        void gatesState.gate(gateKey, { action, evidence }),
    startEdit: gatesState.startEdit,
    stopEdit: gatesState.stopEdit,
    apply: (): undefined => void gatesState.apply(),
})

/** The knowledge card of the setup side: document and fact counts and the links to the brain. */
export const knowledgeOf = (
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
    counts: SetupKnowledgeCounts | null,
    moduleKey: string,
    workspaceId: string,
): SetupSideKnowledge => {
    return {
        title: t("k_cardTitle"),
        businessLine: t("k_cardBusiness", { docs: counts?.documents ?? 0, facts: counts?.facts ?? 0 }),
        publicLine: "",
        emptyHint: counts !== null && counts.documents === 0 && counts.facts === 0 ? t("k_cardEmpty") : "",
        knowledgeHref: workspaceHref(workspaceId, brainTabHref("sources", { module: moduleKey })),
        knowledgeLabel: t("k_cardLink"),
        nivoHref: workspaceHref(workspaceId, KNOWLEDGE_ROUTES.nivo),
        nivoLabel: t("k_nivoLink"),
    }
}

type GateViewMapperResult = (
    gate: NonNullable<
        NonNullable<ReturnType<typeof useModuleCatalog>["modules"][(typeof MODULE_KEYS)[number]]>["gates"]
    >[number],
) => SetupSideView["gates"]["gates"][number]

/** Builds the mapper that turns a catalog gate into its row, with the status of the session evidence. */
export const gateViewMapper = (
    session: SetupSession,
    locale: "vi" | "en",
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
): GateViewMapperResult => {
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

/** The context version list of the setup side, the active version marked. */
export const versionsOf = (
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
