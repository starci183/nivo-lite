"use client"

import { useTranslations } from "next-intl"
import { useWizardPhases } from "@/hooks/connection-wizard"
import { lifecycleChipOf, PHASE_COUNT, phaseOfLife } from "@/modules/connection-lifecycle"
import type { ConnectionLifecycle, ConnectionLifecycleChip, ConnectionSetupView } from "@/modules/types"

/** What a connection page reads of where its connection stands: the status badge, and the setup card while it is unfinished. */
interface ConnectionLifeRead {
    readonly chip: ConnectionLifecycleChip | null
    readonly setup: ConnectionSetupView | null
}

/**
 * The status badge of a connection in the one vocabulary of the Connections screens, and while it is set up or waits for its first
 * event, the setup card's four phases with the one being worked on.
 */
export const useConnectionLife = (life: ConnectionLifecycle | null): ConnectionLifeRead => {
    const t = useTranslations("connections")
    const phases = useWizardPhases("telegram")
    if (life === null) return { chip: null, setup: null }
    const chip = lifecycleChipOf(life, (key, values) => t(key, values))
    if (life.id !== "setup" && life.id !== "waiting") return { chip, setup: null }
    const current = phaseOfLife(life)
    return {
        chip,
        setup: {
            title: t("setupTitle", { n: current, total: PHASE_COUNT }),
            phases: phases.labels,
            current,
            stateLabels: phases.stateLabels,
        },
    }
}
