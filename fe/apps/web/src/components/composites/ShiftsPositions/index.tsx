import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsPositionsProps = ShiftsSetupViews["positions"] & {
    readonly on: ShiftsSetupActions["positions"] | undefined
    readonly isLoading?: boolean
}
import { Input, TagGroup, Text, Cluster } from "@starci/grammar/common"
import { ShiftsSetupCard } from "@/components/branches/ShiftsSetupCard"
import { ShiftsActionButton } from "@/components/leaves/ShiftsActionButton"

/** Draws the positions as removable tags with a field to add a new one. */
export const ShiftsPositions = (props: ShiftsPositionsProps) => (
    <ShiftsSetupCard
        title={props.title}
        hint={props.hint}
        isLoading={props.isLoading}
        body={
            <>
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
                        <ShiftsActionButton
                            isLoading={props.isLoading}
                            intent="neutral"
                            isPending={props.isBusy}
                            isDisabled={!props.canAdd}
                            onPress={props.on?.add}
                            label={props.addLabel}
                        />
                    </Cluster>
                </Cluster>
            </>
        }
    />
)
