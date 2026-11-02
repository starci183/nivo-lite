import type { ReactNode } from "react"
import { Alert, Badge, Button, Section, Text, Cluster, Stack } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { DossierFindingDialogs } from "@/components/composites/DossierFindingDialogs"
import type { FindingDialogValues, FindingDialogView } from "@/components/composites/DossierFindingDialogs"

/** Resolved Section, standing, paging and dialog data shared by inline and drawer findings. */
export interface DossierFindingsFrameView {
    readonly title: string
    readonly badges: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
    readonly reviewedLine: string
    readonly isRunning: boolean
    readonly runningLabel: string
    readonly reviewLabel: string | null
    readonly isReviewPending: boolean
    readonly aiNotice: string | null
    readonly hasNextPage: boolean
    readonly isLoadingMore: boolean
    readonly loadMoreLabel: string
    readonly pageFailure: string | null
    readonly retryLabel: string
    readonly dialog: FindingDialogView | null
}

/** The actual findings anatomy; each owning block supplies its own status region as children. */
interface DossierFindingsFrameProps extends DossierFindingsFrameView {
    readonly children: ReactNode
    readonly onReview: () => void
    readonly onLoadMore: () => void
    readonly onRetry: () => void
    readonly onSubmitDialog: (values: FindingDialogValues) => void
    readonly onCloseDialog: () => void
}

const Standing = (props: Pick<DossierFindingsFrameView, "badges" | "reviewedLine" | "isRunning" | "runningLabel">) => (
    <Cluster gap="inline">
        {props.badges.map((badge) => (
            <Badge key={badge.id} tone={badge.tone}>
                {badge.label}
            </Badge>
        ))}
        <Text tone="muted">{props.isRunning ? props.runningLabel : props.reviewedLine}</Text>
    </Cluster>
)

const More = (
    props: Pick<
        DossierFindingsFrameProps,
        "pageFailure" | "retryLabel" | "onRetry" | "hasNextPage" | "isLoadingMore" | "onLoadMore" | "loadMoreLabel"
    >,
) => {
    if (props.pageFailure !== null)
        return (
            <Alert
                tone="negative"
                title={props.pageFailure}
                action={{ label: props.retryLabel, onAction: props.onRetry }}
            />
        )
    return props.hasNextPage ? (
        <Button intent="neutral" isPending={props.isLoadingMore} onPress={props.onLoadMore}>
            {props.loadMoreLabel}
        </Button>
    ) : null
}

/** Draws the existing findings heading, review standing, notice, rows region, paging and focused dialogs. */
export const DossierFindingsFrame = (props: DossierFindingsFrameProps) => (
    <Section
        title={props.title}
        action={
            props.reviewLabel === null ? undefined : (
                <Button intent="neutral" isPending={props.isReviewPending} onPress={props.onReview}>
                    {props.reviewLabel}
                </Button>
            )
        }
    >
        <Standing
            badges={props.badges}
            reviewedLine={props.reviewedLine}
            isRunning={props.isRunning}
            runningLabel={props.runningLabel}
        />
        {props.aiNotice === null ? null : <Alert tone="cautionary" title={props.aiNotice} />}
        <Stack gap="section">
            {props.children}
            <More
                pageFailure={props.pageFailure}
                retryLabel={props.retryLabel}
                onRetry={props.onRetry}
                hasNextPage={props.hasNextPage}
                isLoadingMore={props.isLoadingMore}
                onLoadMore={props.onLoadMore}
                loadMoreLabel={props.loadMoreLabel}
            />
        </Stack>
        {props.dialog === null ? null : (
            <DossierFindingDialogs
                props={props.dialog}
                on={{ submit: props.onSubmitDialog, close: props.onCloseDialog }}
            />
        )}
    </Section>
)
