import type { useTranslations } from "next-intl"
import type { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import type { useShiftsRequestCommands } from "@/hooks/shiftsCommands"
import {
    Badge,
    Button,
    EmptyNotice,
    ListItem,
    SectionHeader,
    SurfaceCard,
    SurfaceListCard,
} from "@starci/grammar/common"
import { ShiftsLine } from "@/components/composites/ShiftsLine"
import { ACTIONS_CLASS_NAME, PANEL_CLASS_NAME, ROW_CLASS_NAME, SECTION_CLASS_NAME } from "./classNames"

/** Which decision a row takes: the agent work item behind it, or an availability change. */
type DecisionKind = "item" | "availability"

/** One request, already worded for the reader's language. */
export interface RequestRowView {
    readonly id: string
    readonly title: string
    readonly notes: ReadonlyArray<string>
    readonly tone: "success" | "neutral" | "warning"
    readonly badge: string
    /** Set when the manager can still decide the row. */
    readonly decision: { readonly kind: DecisionKind; readonly targetId: string } | null
}

/** A titled group of requests. */
export interface RequestSectionView {
    readonly id: string
    readonly title: string
    readonly hint: string
    readonly rows: ReadonlyArray<RequestRowView>
}

/** Copy, rows and state the connected requests list supplies. */
export interface ShiftsRequestsBaseProps {
    readonly props: {
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly recentTitle: string
        readonly approveLabel: string
        readonly declineLabel: string
        readonly sections: ReadonlyArray<RequestSectionView>
        readonly recent: ReadonlyArray<RequestRowView>
        readonly isBusy: boolean
    }
    readonly on: {
        readonly approve: (kind: DecisionKind, targetId: string) => void
        readonly decline: (kind: DecisionKind, targetId: string) => void
    }
}

/** Draws the open requests by kind, with approve and decline, and the recently handled ones. */
export const ShiftsRequestsBase = (props: ShiftsRequestsBaseProps) => (
    <div className={PANEL_CLASS_NAME}>
        {props.props.sections.length === 0 ? (
            <SurfaceCard ariaLabel={props.props.emptyTitle}>
                <EmptyNotice message={props.props.emptyTitle} description={props.props.emptyBody} />
            </SurfaceCard>
        ) : null}
        {[...props.props.sections, { id: "recent", title: props.props.recentTitle, hint: "", rows: props.props.recent }]
            .filter((section) => section.rows.length > 0)
            .map((section) => (
                <div key={section.id} className={SECTION_CLASS_NAME}>
                    <SectionHeader level={2} title={section.title} description={section.hint || undefined} />
                    <SurfaceListCard ariaLabel={section.title}>
                        {section.rows.map((row) => (
                            <ListItem key={row.id} className={ROW_CLASS_NAME}>
                                <ShiftsLine title={row.title} notes={row.notes} />
                                <div className={ACTIONS_CLASS_NAME}>
                                    <Badge tone={row.tone}>{row.badge}</Badge>
                                    {row.decision === null ? null : (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                isDisabled={props.props.isBusy}
                                                onPress={() => {
                                                    if (row.decision !== null)
                                                        props.on.approve(row.decision.kind, row.decision.targetId)
                                                }}
                                            >
                                                {props.props.approveLabel}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                isDisabled={props.props.isBusy}
                                                onPress={() => {
                                                    if (row.decision !== null)
                                                        props.on.decline(row.decision.kind, row.decision.targetId)
                                                }}
                                            >
                                                {props.props.declineLabel}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </ListItem>
                        ))}
                    </SurfaceListCard>
                </div>
            ))}
    </div>
)

/** State values and commands consumed by the connected surface. */
export type ShiftsRequestsControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly commands: ReturnType<typeof useShiftsRequestCommands>
    readonly busy: boolean
    readonly setBusy: React.Dispatch<React.SetStateAction<boolean>>
}

/** Narrowed schedule data available after the access guard. */
export type CreateShiftsRequestsRowsInput = ShiftsRequestsControllerInput & {
    bench: NonNullable<ShiftsRequestsControllerInput["bench"]>
}
