import type { ContentViews, ContentActions } from "@/modules/types"

type ContentPillarSettingsProps = ContentViews["pillarFields"] & {
    readonly on: ContentActions["pillarActions"]
    readonly isLoading: boolean
}
import { Button, Cluster, Input, NumberField, Stack, Switch } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/leaves/ContentCommandNote"

interface PillarTextFieldProps {
    readonly isLoading: boolean
    readonly row: ContentViews["pillarRow"]
    readonly field: "name" | "description"
    readonly label: string
    readonly locked: boolean
    readonly onChange: ContentPillarSettingsProps["on"]["change"]
}

const PillarTextField = (props: PillarTextFieldProps) => {
    const id = `pillar-${props.field === "name" ? "name" : "desc"}-${props.row.key}`
    return (
        <Input
            isLoading={props.isLoading}
            id={id}
            name={id}
            label={props.label}
            value={props.row[props.field]}
            isDisabled={props.locked}
            onValueChange={(value) => props.onChange(props.row.key, { [props.field]: value })}
        />
    )
}

/** Draws the content themes: name, what it covers, weight, in use, with add, remove, suggested themes and save. */
export const ContentPillarSettings = (props: ContentPillarSettingsProps) => {
    const { copy, canManage, isPending } = props
    const locked = !canManage || isPending
    return (
        <>
            {props.rows.map((row) => (
                <Stack key={row.key} gap="row">
                    <PillarTextField
                        isLoading={props.isLoading}
                        row={row}
                        field="name"
                        label={copy.pillarName}
                        locked={locked}
                        onChange={props.on.change}
                    />
                    <PillarTextField
                        isLoading={props.isLoading}
                        row={row}
                        field="description"
                        label={copy.pillarDesc}
                        locked={locked}
                        onChange={props.on.change}
                    />
                    <NumberField
                        isLoading={props.isLoading}
                        label={copy.pillarWeight}
                        value={row.weight}
                        minValue={0}
                        maxValue={20}
                        isDisabled={locked}
                        onValueChange={(v) => props.on.change(row.key, { weight: v })}
                    />
                    <Cluster gap="inline">
                        <Switch
                            isLoading={props.isLoading}
                            label={copy.pillarActive}
                            isSelected={row.active}
                            isDisabled={locked}
                            onSelectedChange={(v) => props.on.change(row.key, { active: v })}
                        />
                        <Button
                            isLoading={props.isLoading}
                            intent="destructive"
                            step="entry"
                            isDisabled={locked}
                            onPress={() => props.on.remove(row.key)}
                        >
                            {copy.remove}
                        </Button>
                    </Cluster>
                </Stack>
            ))}
            <ContentCommandNote note={props.note} closeLabel={copy.close} onDismiss={props.on.dismissNote} />
            <PillarCommands {...props} />
        </>
    )
}

/** The theme collection's add/preset/save commands remain below its editable rows. */
const PillarCommands = (props: ContentPillarSettingsProps) => (
    <Cluster gap="inline">
        <Button
            isLoading={props.isLoading}
            intent="neutral"
            size="sm"
            isDisabled={!props.canManage || props.isPending}
            onPress={props.on.add}
        >
            {props.copy.pillarAdd}
        </Button>
        {props.rows.length === 0 ? (
            <Button
                isLoading={props.isLoading}
                intent="alternative"
                size="sm"
                isDisabled={!props.canManage || props.isPending}
                onPress={props.on.preset}
            >
                {props.copy.pillarPreset}
            </Button>
        ) : null}
        <Button
            isLoading={props.isLoading}
            intent="commit"
            size="sm"
            onPress={props.on.save}
            isDisabled={!props.canManage}
            isPending={props.isPending}
        >
            {props.copy.pillarSave}
        </Button>
    </Cluster>
)
