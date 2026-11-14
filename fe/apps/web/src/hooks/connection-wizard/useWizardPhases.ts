"use client"

import { useTranslations } from "next-intl"
import { CONNECTION_PHASES, WIZARD_PHASES, type WizardPhaseKind } from "@/modules/connection-lifecycle"
import type { WizardPhases } from "@/modules/types"

/**
 * The four shared phases of a connection wizard (details, grant, check, hand to an agent) in the reader's language, with the phase of
 * each of this wizard's steps, for the Stepper of the shared wizard frame.
 */
export const useWizardPhases = (kind: WizardPhaseKind): WizardPhases => {
    const t = useTranslations("connections")
    return {
        labels: CONNECTION_PHASES.map((phase) => t(`phase_${phase}`)),
        ofStep: WIZARD_PHASES[kind],
        stateLabels: { complete: t("phaseDone"), current: t("phaseCurrent"), upcoming: t("phaseUpcoming") },
    }
}
