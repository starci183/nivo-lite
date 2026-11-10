import { Button, Text, Cluster } from "@starci/grammar/common"
interface VideoStepFooterProps {
    readonly backLabel: string
    readonly nextLabel: string
    readonly note?: string | null
    readonly pending: boolean
    readonly nextDisabled: boolean
    readonly isLoading?: boolean
    readonly onBack: () => void
    readonly onNext: () => void
}
/** The existing footer anatomy now lives at its actual leaf owner. */
export const VideoStepFooter = (props: VideoStepFooterProps) => (
    <Cluster gap="inline" justify="between">
        <Button intent="neutral" isDisabled={props.pending} isLoading={props.isLoading ?? false} onPress={props.onBack}>
            {props.backLabel}
        </Button>
        <Cluster gap="inline">
            {props.note === null || props.note === undefined ? null : (
                <Text as="span" size="sm" tone="muted" isLoading={props.isLoading ?? false}>
                    {props.note}
                </Text>
            )}
            <Button endArrow
                intent="commit"
                isPending={props.pending}
                isDisabled={props.nextDisabled}
                isLoading={props.isLoading ?? false}
                onPress={props.onNext}
            >
                {props.nextLabel}
            </Button>
        </Cluster>
    </Cluster>
)
