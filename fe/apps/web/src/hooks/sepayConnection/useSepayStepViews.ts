"use client"

import { useTranslations } from "next-intl"
import { useConnectionsRole } from "@/hooks/connections"
import { useConnectionGrantsBand } from "@/hooks/connectionsPanes"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { SepayConnectionView } from "@/modules/types"
import { useSepayAccountView } from "./useSepayAccountView"
import { useSepayChecklistView } from "./useSepayChecklistView"
import { useSepayCommands } from "./useSepayCommands"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayLiveSwitch } from "./useSepayLiveSwitch"
import { useSepayPasteView } from "./useSepayPasteView"
import { useSepaySetupSteps } from "./useSepaySetupSteps"

/** What the five steps of a SePay connection draw, in the words of the reader, and the commands behind them. */
interface SepayStepViews {
    readonly stepsLabel: string
    readonly steps: ReturnType<typeof useSepaySetupSteps>["steps"]
    readonly openSepay: ReturnType<typeof useSepaySetupSteps>["openSepay"]
    readonly matching: string
    readonly environment: {
        readonly label: string
        readonly options: ReadonlyArray<{ readonly value: "test" | "live"; readonly label: string }>
        readonly slot: ReturnType<typeof mapSlot<SepayConnectionView, EnvironmentView>>
        readonly placeholder: EnvironmentView
        readonly slotLabels: ReturnType<ReturnType<typeof useSlotLabels>>
    }
    readonly account: ReturnType<typeof useSepayAccountView>["view"]
    readonly paste: ReturnType<typeof useSepayPasteView>["view"]
    readonly checklist: ReturnType<typeof useSepayChecklistView>
    readonly grants: ReturnType<typeof useConnectionGrantsBand>
    readonly on: ReturnType<typeof useSepayAccountView>["on"] &
        ReturnType<typeof useSepayPasteView>["on"] & {
            readonly toggle: (id: string, isOpen: boolean) => void
            readonly retry: () => void
            readonly changeEnvironment: (environment: "test" | "live") => void
        }
}

/** The selected environment and whether the viewer may change it. */
interface EnvironmentView {
    readonly value: "test" | "live"
    readonly description: string
    readonly isDisabled: boolean
}

/** The five setup steps of a SePay connection: the words and data of each step body, read together so the steps draw as one list. */
export const useSepayStepViews = (connectionId: string): SepayStepViews => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const { slot, retry } = useSepayConnection(connectionId)
    const commands = useSepayCommands(connectionId)
    const { role } = useConnectionsRole()
    const setup = useSepaySetupSteps(connectionId)
    const liveSwitch = useSepayLiveSwitch(connectionId)
    const account = useSepayAccountView(connectionId)
    const paste = useSepayPasteView(connectionId)
    const environmentOf = (view: SepayConnectionView): EnvironmentView => ({
        value: view.environment,
        description: t(view.environment === "test" ? "environmentTestNote" : "environmentLiveNote"),
        isDisabled: role !== "owner" || view.status === "disconnected",
    })
    return {
        stepsLabel: setup.stepsLabel,
        steps: setup.steps,
        openSepay: setup.openSepay,
        matching: t("matchingRule"),
        environment: {
            label: t("stepEnvironment"),
            options: [
                { value: "test", label: t("envTestShort") },
                { value: "live", label: t("envLive") },
            ],
            slot: mapSlot(slot, environmentOf),
            placeholder: { value: "test", description: t("environmentTestNote"), isDisabled: true },
            slotLabels: slotLabels(t("stepEnvironment")),
        },
        account: account.view,
        paste: paste.view,
        checklist: useSepayChecklistView(connectionId),
        grants: useConnectionGrantsBand(connectionId),
        on: {
            ...account.on,
            ...paste.on,
            retry,
            toggle: (id, isOpen) => {
                const step = setup.steps.find((candidate) => candidate.id === id)
                if (step !== undefined) setup.toggle(step.id, isOpen)
            },
            changeEnvironment: (environment) => {
                if (environment === "live") return liveSwitch.ask()
                void commands.setEnvironment(environment)
            },
        },
    }
}
