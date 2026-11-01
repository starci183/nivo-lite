"use client"

import { useTranslations } from "next-intl"
import { LENS_LANES, useAgentLenses } from "@/hooks/brain"
import type { AgentLens } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { BrainAgentViewBase } from "./component"
import type { AudienceView, LaneView } from "./component"

/** The connected matrix: what the customer and every installed agent may read of the shared knowledge, as the back end's own policy says. */
export const BrainAgentView = () => {
    const t = useTranslations("secondBrain")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAgentLenses()
    const matrixOf = (views: ReadonlyArray<AgentLens>) => {
        const audiences: ReadonlyArray<AudienceView> = views.map((lens) => ({
            id: lens.id,
            kind: lens.kind,
            name: lens.kind === "customer" ? t("audienceCustomer") : (lens.name ?? ""),
            avatarUrl: lens.avatarUrl ?? undefined,
        }))
        const lanes: ReadonlyArray<LaneView> = LENS_LANES.map((lane) => ({
            id: lane,
            label: t(`lane_${lane}`),
            cells: Object.fromEntries(
                views.flatMap((lens) => {
                    const cell = lens.cells.find((one) => one.lane === lane)
                    return cell === undefined ? [] : [[lens.id, { isOpen: cell.isOpen, count: cell.count }] as const]
                }),
            ),
        }))
        return { audiences, lanes }
    }
    return (
        <BrainAgentViewBase
            props={{
                title: t("viewTitle"),
                hint: t("viewHint"),
                footer: t("viewFooter"),
                tableLabel: t("viewTitle"),
                laneLabel: t("viewLane"),
                whoLabel: t("viewWho"),
                openLabel: t("viewOpen"),
                matrix: slot.items?.length === 0 ? {} : mapSlot(slot, matrixOf),
                slotLabels: slotLabels(t("viewEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}
