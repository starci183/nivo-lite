import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsPositionsProps = ShiftsSetupViews["positions"] & {
    readonly on: ShiftsSetupActions["positions"] | undefined
    readonly isLoading?: boolean
}
import { Button, Input, SurfaceCard, TagGroup, Text, Stack, Cluster } from "@starci/grammar/common"

/** Draws the positions as removable tags with a field to add a new one. */
export const ShiftsPositions = (props: ShiftsPositionsProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        label={props.title}
        headingLevel={2}
    >
        <Stack gap="row">
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
            <TagGroup
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                label={props.title}
                items={props.positions.map((position) => ({
                    id: position.id,
                    label: position.label,
                }))}
                onRemove={(ids) => ids.forEach((id) => props.on?.remove(id))}
                removeLabel={(label) => `${props.removeLabel} ${label}`}
                emptyContent={
                    <Text
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        size="sm"
                        tone="muted"
                    >
                        {props.emptyLabel}
                    </Text>
                }
            />
            <Cluster gap="row" align="end">
                <Input
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    id="shifts-position-new"
                    name="position"
                    label={props.nameLabel}
                    value={props.name}
                    {...(props.on === undefined ? {} : { onValueChange: props.on.name })}
                />
                <Cluster gap="inline" align="end">
                    <Button
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        intent="neutral"
                        isPending={props.isBusy}
                        isDisabled={!props.canAdd}
                        {...(props.on === undefined ? {} : { onPress: props.on.add })}
                    >
                        {props.addLabel}
                    </Button>
                </Cluster>
            </Cluster>
        </Stack>
    </SurfaceCard>
)
