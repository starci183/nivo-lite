import { Button, Input, SurfaceCard, TagGroup, Text } from "@starci/grammar/common"
import { BLOCK_CLASS_NAME, FIELD_ACTION_CLASS_NAME, ROW_CLASS_NAME, SWATCH_CLASS_NAME } from "./classNames"

/** One position with its colour. */
interface PositionView {
    readonly id: string
    readonly label: string
    readonly color: string
}

/** Copy, positions and state the connected positions card supplies. */
export interface ShiftsPositionsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly emptyLabel: string
        readonly nameLabel: string
        readonly addLabel: string
        readonly removeLabel: string
        readonly positions: ReadonlyArray<PositionView>
        readonly name: string
        readonly isBusy: boolean
        readonly canAdd: boolean
    }
    readonly on: {
        readonly name: (value: string) => void
        readonly add: () => void
        readonly remove: (id: string) => void
    }
}

/** Draws the positions as removable tags with a field to add a new one. */
export const ShiftsPositionsBase = (props: ShiftsPositionsBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            <TagGroup
                label={props.props.title}
                items={props.props.positions.map((position) => ({
                    id: position.id,
                    label: position.label,
                    leading: <i className={SWATCH_CLASS_NAME} style={{ background: position.color }} aria-hidden />,
                }))}
                onRemove={(ids) => ids.forEach((id) => props.on.remove(id))}
                removeLabel={(label) => `${props.props.removeLabel} ${label}`}
                emptyContent={
                    <Text size="sm" tone="muted">
                        {props.props.emptyLabel}
                    </Text>
                }
            />
            <div className={ROW_CLASS_NAME}>
                <Input
                    id="shifts-position-new"
                    name="position"
                    label={props.props.nameLabel}
                    variant="secondary"
                    value={props.props.name}
                    onValueChange={props.on.name}
                />
                <div className={FIELD_ACTION_CLASS_NAME}>
                    <Button
                        variant="outline"
                        isPending={props.props.isBusy}
                        isDisabled={!props.props.canAdd}
                        onPress={props.on.add}
                    >
                        {props.props.addLabel}
                    </Button>
                </div>
            </div>
        </div>
    </SurfaceCard>
)
