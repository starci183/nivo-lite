import { Alert, Badge, Cluster, Stack, Text } from "@starci/grammar/common"
import { FieldBlock, fieldFrameOf } from "@/components/frames/FieldBlock"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Who answers for the agent, with every word resolved. */
export interface OwnerView {
    /** The person's display name, never the login handle. */
    readonly name: string
    readonly roleLabel: string
    /** The notice shown when the stored owner left or was disabled; null otherwise. */
    readonly notice: { readonly title: string; readonly description: string } | null
    /** The person who takes over when the responder cannot; null when none is named. */
    readonly fallback: { readonly label: string; readonly name: string } | null
}

/** Copy and state of the "Nguoi phu trach" field. */
export interface AgentProfileOwnerBaseProps {
    readonly props: {
        readonly title: string
        /** What the person answers for: the field's one description line. */
        readonly description: string
        /** The read, its same-shape placeholder and the words of its states, as SlotView takes them. */
        readonly read: {
            readonly slot: DataSlot<OwnerView>
            readonly placeholder: OwnerView
            readonly labels: SlotLabels
        }
    }
    readonly on: { readonly retry: () => void }
}

/** Draws who answers for the agent as a flat field: the title and what they answer for on the left, the person on the right. */
export const AgentProfileOwnerBase = (props: AgentProfileOwnerBaseProps) => {
    const { title, description } = props.props
    return (
        <SlotView
            {...props.props.read}
            onRetry={props.on.retry}
            frame={fieldFrameOf(title, description)}
            render={(owner, isSkeleton) => (
                <FieldBlock
                    title={title}
                    description={description}
                    trailing={
                        <Cluster gap="inline" wrap={false}>
                            <PersonAvatar name={owner.name} size="md" isLoading={isSkeleton} />
                            <Stack gap="identity">
                                <Text isStrong isLoading={isSkeleton}>
                                    {owner.name}
                                </Text>
                                <Text size="xs" tone="muted" isLoading={isSkeleton}>
                                    {owner.roleLabel}
                                </Text>
                            </Stack>
                        </Cluster>
                    }
                >
                    {owner.notice === null && owner.fallback === null ? undefined : (
                        <Stack gap="row">
                            {owner.notice === null ? null : (
                                <Alert
                                    tone="cautionary"
                                    title={owner.notice.title}
                                    description={owner.notice.description}
                                />
                            )}
                            {owner.fallback === null ? null : (
                                <Text size="sm" tone="muted">
                                    <Badge tone="neutral">{owner.fallback.label}</Badge> {owner.fallback.name}
                                </Text>
                            )}
                        </Stack>
                    )}
                </FieldBlock>
            )}
        />
    )
}
