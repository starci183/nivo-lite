import { Button, PaneSection, SectionHeader } from "@starci/grammar/common"

/** Props for {@link ConnectionDisconnectBand}. */
type ConnectionDisconnectBandProps = {
    readonly title: string
    readonly description: string
    readonly label: string
    readonly onPress: () => void
}

/** The last band of a provider page's main pane: what disconnecting does, and the destructive entry that asks first. */
export const ConnectionDisconnectBand = (props: ConnectionDisconnectBandProps) => (
    <PaneSection>
        <SectionHeader
            level={2}
            title={props.title}
            description={props.description}
            action={
                <Button intent="destructive" step="entry" onPress={props.onPress}>
                    {props.label}
                </Button>
            }
        />
    </PaneSection>
)
