import { Alert, Badge, Button, EmptyNotice, Heading, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import { ACTIONS_CLASS_NAME, HEAD_CLASS_NAME, LINES_CLASS_NAME, WEEK_CLASS_NAME } from "./classNames"

/** What the commands of an interview need to know. */
interface InterviewActionsView {
    readonly id: string
    readonly candidateId: string
    readonly isConfirmed: boolean
}

/** One interview, every word already resolved. */
interface InterviewRowView extends InterviewActionsView {
    readonly title: string
    readonly meta: string
}

/** One day of the week. */
interface InterviewDayView {
    readonly key: string
    readonly label: string
    readonly isToday: boolean
    readonly items: ReadonlyArray<InterviewRowView>
}

/** One invitation still waiting for the candidate to pick a time. */
interface InvitationRowView extends InterviewRowView {
    readonly badge: string
    readonly proposed: string
    readonly note: string | null
    readonly copyLabel: string
}

/** What the connected block settled for the interviews tab. */
export interface HiringInterviewsBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly weekLabel: string
        readonly isThisWeek: boolean
        readonly days: ReadonlyArray<InterviewDayView>
        readonly invitations: ReadonlyArray<InvitationRowView>
        readonly invitationsFact: string
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly previousWeek: () => void
        readonly nextWeek: () => void
        readonly thisWeek: () => void
        readonly open: (candidateId: string) => void
        readonly status: (id: string, status: string) => void
        readonly copy: (id: string) => void
        readonly clearError: () => void
    }
}

/** Draws the interviews tab: a week calendar of confirmed interviews (an agenda on phones) and the invitations awaiting an answer. */
export const HiringInterviewsBase = (props: HiringInterviewsBaseProps) => {
    const { say, weekLabel, isThisWeek, days, invitations, invitationsFact, isBusy, error } = props.props
    const { on } = props
    const actions = (row: InterviewActionsView) => (
        <div className={ACTIONS_CLASS_NAME}>
            <Button variant="tertiary" size="sm" onPress={() => on.open(row.candidateId)}>
                {say("pipeOpen")}
            </Button>
            {row.isConfirmed ? (
                <Button variant="secondary" size="sm" isDisabled={isBusy} onPress={() => on.status(row.id, "done")}>
                    {say("ivMarkDone")}
                </Button>
            ) : null}
            {row.isConfirmed ? (
                <Button variant="ghost" size="sm" isDisabled={isBusy} onPress={() => on.status(row.id, "no_show")}>
                    {say("ivMarkNoShow")}
                </Button>
            ) : null}
            <Button variant="ghost" size="sm" isDisabled={isBusy} onPress={() => on.status(row.id, "cancelled")}>
                {say("ivCancel")}
            </Button>
        </div>
    )
    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <Heading level={2}>{say("ivTabTitle")}</Heading>
                <div className={ACTIONS_CLASS_NAME}>
                    <Button variant="tertiary" size="sm" onPress={on.previousWeek}>
                        {say("ivPrevWeek")}
                    </Button>
                    <Text as="span" size="sm" weight="medium">
                        {weekLabel}
                    </Text>
                    <Button variant="tertiary" size="sm" onPress={on.nextWeek}>
                        {say("ivNextWeek")}
                    </Button>
                    {isThisWeek ? null : (
                        <Button variant="ghost" size="sm" onPress={on.thisWeek}>
                            {say("ivBackToThisWeek")}
                        </Button>
                    )}
                </div>
            </div>
            {error === null ? null : (
                <Alert
                    tone="negative"
                    title={say("errorTitle")}
                    description={error}
                    dismissLabel={say("dismiss")}
                    onDismiss={on.clearError}
                />
            )}
            <div className={WEEK_CLASS_NAME}>
                {days.map((day) => (
                    <SurfaceListCard
                        key={day.key}
                        label={day.label}
                        labelEnd={day.isToday ? <Badge tone="accent">{say("ivToday")}</Badge> : undefined}
                        empty={<EmptyNotice message={say("ivDayEmpty")} />}
                    >
                        {day.items.map((row) => (
                            <ListRow key={row.id} title={row.title} description={row.meta}>
                                {actions(row)}
                            </ListRow>
                        ))}
                    </SurfaceListCard>
                ))}
            </div>
            <SurfaceListCard
                label={say("ivWaitingTitle")}
                fact={invitationsFact}
                empty={<EmptyNotice message={say("ivWaitingEmpty")} description={say("ivWaitingEmptyBody")} />}
            >
                {invitations.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        badges={<Badge tone="warning">{row.badge}</Badge>}
                        description={row.meta}
                        actions={
                            <Button variant="tertiary" size="sm" onPress={() => on.copy(row.id)}>
                                {row.copyLabel}
                            </Button>
                        }
                    >
                        <div className={LINES_CLASS_NAME}>
                            <Text size="xs" tone="muted">
                                {row.proposed}
                            </Text>
                            {row.note === null ? null : <Text size="sm">{row.note}</Text>}
                            {actions(row)}
                        </div>
                    </ListRow>
                ))}
            </SurfaceListCard>
        </>
    )
}
