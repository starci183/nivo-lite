import { DescriptionList, EmptyNotice, PaneSection, Section, Stepper } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { ConnectionPaneFrame } from "@/components/frames/ConnectionPaneFrame"

/** The words of a connection page while it loads: the title, the step titles and the rail heading are real. */
export interface ConnectionPageLoadingProps {
    readonly props: {
        readonly title: string
        readonly mainLabel: string
        /** The rail heading; absent for a provider with no rail. */
        readonly railLabel?: string
        readonly steps: ReadonlyArray<{ readonly id: string; readonly title: string }>
    }
}

const TILES = ["token", "followers", "agents"].map((id) => ({ id, term: "-", description: "-" }))

/**
 * STATE-8: a provider connection page with no data yet, inside the Connections frame - the head band over the main pane and the
 * rail; the step titles and the rail heading are real, the name, the facts, the tiles and the events are inert geometry.
 */
export const ConnectionPageLoading = (props: ConnectionPageLoadingProps) => {
    const { railLabel } = props.props
    return (
        <ConnectionPaneFrame
            gridLabel={props.props.title}
            mainLabel={props.props.mainLabel}
            head={<PaneHead title={props.props.title} headingLevel={1} isLoading />}
            {...(railLabel === undefined
                ? {}
                : {
                      rail: { label: railLabel, closeLabel: railLabel },
                      aside: (
                          <PaneSection isLoading>
                              <Section
                                  title={railLabel}
                                  kind="list"
                                  items={[]}
                                  empty={<EmptyNotice message={railLabel} />}
                              />
                          </PaneSection>
                      ),
                  })}
        >
            <PaneSection>
                <DescriptionList layout="columns" isDivided isLoading items={TILES} />
            </PaneSection>
            <PaneSection isLoading>
                <Stepper
                    label={props.props.mainLabel}
                    orientation="vertical"
                    currentStepId=""
                    steps={props.props.steps.map((step) => ({ id: step.id, label: step.title }))}
                />
            </PaneSection>
        </ConnectionPaneFrame>
    )
}
