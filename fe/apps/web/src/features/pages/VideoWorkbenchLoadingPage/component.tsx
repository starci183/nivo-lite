import { AgentDashboardFrame } from "@/features/agent-dashboard"

/** One figure term of the ribbon. */
export interface VideoLoadingFigure {
    readonly id: string
    readonly term: string
}

/** The real labels of the workbench while its values load. */
export interface VideoWorkbenchLoadingPageBaseProps {
    readonly props: {
        readonly figures: ReadonlyArray<VideoLoadingFigure>
        readonly libraryTab: string
        readonly brandTab: string
    }
}

/** Draws the workbench frame with no data yet: its own tree, the real terms and tab labels, values and lists as skeleton. */
export const VideoWorkbenchLoadingPageBase = (props: VideoWorkbenchLoadingPageBaseProps) => (
    <AgentDashboardFrame
        module="video"
        isLoading
        figures={props.props.figures.map((figure) => ({ id: figure.id, term: figure.term, description: "" }))}
        tabs={[
            { id: "library", label: props.props.libraryTab },
            { id: "brand", label: props.props.brandTab },
        ]}
    />
)
