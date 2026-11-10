import type { useSetupGates } from "@/hooks/agentSetup"
import type { useModuleCatalog } from "@/hooks/moduleCatalog"
import type { MODULE_KEYS } from "@/modules/catalog"
import { gateEntry, gateHint, gateLabel } from "@/modules/installations"
import type { SetupSession } from "@/modules/installations"
import type { useSetupRequirements } from "@/hooks/setupRequirements"
import type { SetupSideGate, SetupSideNotice, SetupSideView } from "@/modules/types"
import type { useTranslations } from "next-intl"

import type { Dispatch, SetStateAction } from "react"

/** The words of a gate key that say it is something the agent must never do, or must ask first. */
const NEVER_KEY = /prohibit|forbid|never|banned/
const ASK_KEY = /approv|threshold|escalat|handoff|limit|consent|confirm/

/** What the agent does about a gate: the catalogue names no mode yet, so the key says it (prohibited actions, approval thresholds), else the agent works on its own. */
export const gateGroupOf = (key: string): SetupSideGate["group"] => {
    if (NEVER_KEY.test(key)) return "never"
    return ASK_KEY.test(key) ? "ask" : "auto"
}

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
        group: "auto",
    }),
)

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
            group: gateGroupOf(gate.key),
        }
    }
}
