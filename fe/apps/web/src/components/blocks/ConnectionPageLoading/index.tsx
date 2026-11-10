import type { ReactElement } from "react"
import { EmptyNotice, Grid, Section, Stack, Stepper, SurfaceCard } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The words of a connection page while its tab loads: the phase names and the rail heading are real. */
export interface ConnectionPageLoadingProps {
    readonly props: {
        readonly title: string
        readonly mainLabel: string
        /** The rail heading; absent for a provider with no rail. */
        readonly railLabel?: string
        readonly steps: ReadonlyArray<{ readonly id: string; readonly title: string }>
    }
}

const FACTS = ["a", "b", "c", "d"].map((id) => ({ id, term: "-", description: "-" }))

/**
 * STATE-8: the overview of a connection page with no data yet, under the band its layout draws - the setup phases, the facts and the
 * rail; the phase names and the rail heading are real, the rest is inert geometry.
 */
export const ConnectionPageLoading = (props: ConnectionPageLoadingProps): ReactElement => {
    const { railLabel } = props.props
    const main = (
        <Stack gap="region">
            <SurfaceCard label={props.props.title} isLoading>
                <Stepper
                    label={props.props.mainLabel}
                    currentStepId=""
                    isLoading
                    steps={props.props.steps.map((step) => ({ id: step.id, label: step.title }))}
                />
            </SurfaceCard>
            <SurfaceCard kind="details" label={props.props.mainLabel} isLoading items={FACTS} />
        </Stack>
    )
    if (railLabel === undefined) return main
    return (
        <Grid
            kind="main-rail"
            railWidth="medium"
            align="start"
            primary={main}
            rail={
                <Section
                    kind="list"
                    title={railLabel}
                    isLoading
                    items={[]}
                    empty={<EmptyNotice message={railLabel} iconSource={nivoIconSource("link", "leading")} />}
                />
            }
        />
    )
}
