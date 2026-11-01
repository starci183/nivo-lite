import { Button, Heading, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { CENTERED_CLASS_NAME } from "./classNames"

/** Copy and state the connected ready screen supplies. */
export interface OnboardingReadyBaseProps {
    readonly props: {
        readonly title: string
        readonly heading: string
        readonly description: string
        readonly enterLabel: string
        readonly isSkeleton: boolean
    }
    readonly on: { readonly enter: () => void }
}

/** Draws the end of the first run: the workspace is ready, the first thing to do, and the way in. */
export const OnboardingReadyBase = (props: OnboardingReadyBaseProps) => (
    <SurfaceCard ariaLabel={props.props.title} measure="form">
        <div className={CENTERED_CLASS_NAME}>
            <Stack gap="section" align="center">
                <Heading level={1} isSkeleton={props.props.isSkeleton}>
                    {props.props.heading}
                </Heading>
                <Text tone="muted">{props.props.description}</Text>
                <Button intent="commit" onPress={props.on.enter}>
                    {props.props.enterLabel}
                </Button>
            </Stack>
        </div>
    </SurfaceCard>
)
