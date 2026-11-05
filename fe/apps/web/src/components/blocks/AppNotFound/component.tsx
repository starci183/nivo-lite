import { EmptyNotice, Page, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The words and the way home of the unknown-route page. */
export interface AppNotFoundBaseProps {
    readonly props: {
        readonly grid: string
        readonly title: string
        readonly text: string
        readonly homeLabel: string
    }
    readonly on: { readonly goHome: () => void }
}

/** Draws the unknown-route page as one pane under the console frame: the head band with the name, and the notice that names what happened and offers the way home. */
export const AppNotFoundBase = (props: AppNotFoundBaseProps) => (
    <Page chrome="panes">
        <PaneGrid label={props.props.grid} areas={["head", "main"]} rows={["auto", "fill"]}>
            <Pane area="head" surface>
                <PaneHead title={props.props.title} headingLevel={1} />
            </Pane>
            <Pane area="main" label={props.props.grid}>
                <PaneSection align="center" grow>
                    <EmptyNotice
                        message={props.props.title}
                        description={props.props.text}
                        iconSource={nivoIconSource("explore", "leading")}
                        actionLabel={props.props.homeLabel}
                        onAction={props.on.goHome}
                    />
                </PaneSection>
            </Pane>
        </PaneGrid>
    </Page>
)
