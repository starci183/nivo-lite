import type { useSetupGates } from "@/hooks/agentSetup"
import type { useSetupRequirements } from "@/hooks/setupRequirements"
import type { SetupSideNotice, SetupSideVersions, SetupSideView } from "@/modules/types"
import type { useTranslations } from "next-intl"

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

/** The commands of the checklist: edit, confirm, reopen and apply. */
export const commandsOf = (gatesState: ReturnType<typeof useSetupGates>) => ({
    editText: gatesState.setEditText,
    gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) =>
        void gatesState.gate(gateKey, { action, evidence }),
    startEdit: gatesState.startEdit,
    stopEdit: gatesState.stopEdit,
    apply: () => void gatesState.apply(),
})
