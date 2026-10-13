import { Alert, Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import type { AccountingDashboardSectionView } from "@/modules/types"
import { LABEL_END_CLASS_NAME } from "./classNames"

/** Settled region data, its load state, and the reader's retry action. */
interface AccountingDashboardSectionProps {
    readonly state: { readonly isLoading: boolean }
    readonly props: {
        readonly view: AccountingDashboardSectionView
        readonly failureTitle: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws one independently fallible accounting dashboard collection. */
export const AccountingDashboardSection = (props: AccountingDashboardSectionProps) => {
    const view = props.props.view
    if (props.state.isLoading) return <SurfaceListCard label={view.label} isLoading />
    if (view.hasFailed) {
        return (
            <Alert
                tone="negative"
                title={props.props.failureTitle}
                description={view.failedDescription}
                action={{ label: props.props.retryLabel, onAction: props.on.retry }}
            />
        )
    }
    return (
        <SurfaceListCard
            label={view.label}
            labelEnd={
                <div className={LABEL_END_CLASS_NAME}>
                    {view.badge === undefined ? null : (
                        <Badge tone={view.badge.tone} isDot={view.badge.isDot}>
                            {view.badge.label}
                        </Badge>
                    )}
                    {view.link === undefined ? null : (
                        <TextAction size="sm" href={view.link.href}>
                            {view.link.label}
                        </TextAction>
                    )}
                </div>
            }
            empty={<EmptyNotice message={view.empty} description={view.emptyBody} />}
            footer={
                view.footer === undefined ? undefined : (
                    <Text size="sm" tone="muted">
                        {view.footer}
                    </Text>
                )
            }
        >
            {view.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={
                        row.href === undefined ? (
                            row.title
                        ) : (
                            <TextAction appearance="plain" href={row.href}>
                                {row.title}
                            </TextAction>
                        )
                    }
                    description={row.description}
                    actions={
                        row.action === undefined ? undefined : (
                            <Button size="sm" variant="secondary" href={row.action.href}>
                                {row.action.label}
                            </Button>
                        )
                    }
                    badges={row.badges?.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone} isDot={badge.isDot}>
                            {badge.label}
                        </Badge>
                    ))}
                />
            ))}
        </SurfaceListCard>
    )
}
