import { Alert, DescriptionList, SurfaceCard } from "@starci/grammar/common"

/** One key figure, already worded. */
export interface FigureView {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly meta: string
}

/** The notice that documents are still being read. */
interface ProcessingView {
    readonly title: string
    readonly body: string
}

/** The action that brings the brain up to date. */
interface MaintainView {
    readonly title: string
    readonly body: string
    readonly actionLabel: string
}

/** Copy and figures the connected Second Brain figures supply. */
export interface BrainStatsBaseProps {
    readonly props: {
        readonly label: string
        readonly figures: ReadonlyArray<FigureView>
        /** The figures are loading: the labels stay, the values are skeletons. */
        readonly isSkeleton: boolean
        readonly processing?: ProcessingView
        /** Something is due: a scheduled value waits to take over or a value in force has ended. Nothing is drawn for it while undefined. */
        readonly maintain?: MaintainView
    }
    readonly on: { readonly maintain: () => void }
}

/** Draws the figures of the Second Brain and, while documents are being read, an informative notice. */
export const BrainStatsBase = (props: BrainStatsBaseProps) => (
    <>
        <SurfaceCard ariaLabel={props.props.label}>
            <DescriptionList
                layout="stat-strip"
                isDivided
                isLoading={props.props.isSkeleton}
                items={props.props.figures.map((figure) => ({
                    id: figure.id,
                    term: figure.term,
                    description: figure.value,
                    meta: figure.meta,
                }))}
            />
        </SurfaceCard>
        {props.props.maintain === undefined ? null : (
            <Alert
                tone="cautionary"
                title={props.props.maintain.title}
                description={props.props.maintain.body}
                action={{ label: props.props.maintain.actionLabel, onAction: props.on.maintain }}
            />
        )}
        {props.props.processing === undefined ? null : (
            <Alert
                tone="informative"
                appearance="soft"
                title={props.props.processing.title}
                description={props.props.processing.body}
            />
        )}
    </>
)
