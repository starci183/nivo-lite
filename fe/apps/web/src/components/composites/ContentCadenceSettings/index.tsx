import type { ContentViews, ContentActions } from "@/modules/types"

type ContentCadenceSettingsProps = ContentViews["cadenceFields"] & {
    readonly on: ContentActions["cadenceActions"]
    readonly isLoading: boolean
}
import { Button, CheckboxGroup, Cluster, Input, NumberField, Stack, SurfaceCard, Switch } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/leaves/ContentCommandNote"

/** Draws the posting rhythm: per channel the posts per week, the weekdays and the time (Vietnam time). */
export const ContentCadenceSettings = (props: ContentCadenceSettingsProps) => {
    const { copy, canManage, isPending } = props
    const locked = !canManage || isPending
    return (
        <>
            {props.rows.map((row) => (
                <SurfaceCard isLoading={props.isLoading} key={row.channel} ariaLabel={row.label}>
                    <Stack gap="row">
                        <Switch
                            isLoading={props.isLoading}
                            label={`${copy.cadenceOn}: ${row.label}`}
                            isSelected={row.on}
                            isDisabled={locked}
                            onSelectedChange={(v) => props.on.change(row.channel, { on: v })}
                        />
                        {row.on ? (
                            <>
                                <NumberField
                                    isLoading={props.isLoading}
                                    label={copy.cadencePerWeek}
                                    value={row.perWeek}
                                    minValue={1}
                                    maxValue={21}
                                    isDisabled={locked}
                                    onValueChange={(v) => props.on.change(row.channel, { perWeek: v })}
                                />
                                <Input
                                    isLoading={props.isLoading}
                                    id={`cad-time-${row.channel}`}
                                    name={`cad-time-${row.channel}`}
                                    label={copy.cadenceTime}
                                    value={row.time}
                                    description={copy.addTimeHint}
                                    isDisabled={locked}
                                    onValueChange={(v) => props.on.change(row.channel, { time: v })}
                                />
                                <CheckboxGroup
                                    isLoading={props.isLoading}
                                    label={copy.cadenceDays}
                                    orientation="horizontal"
                                    isDisabled={locked}
                                    options={props.dayNames.map((d, k) => ({
                                        value: String(k + 1),
                                        label: d,
                                    }))}
                                    value={row.days.map(String)}
                                    onValueChange={(v) =>
                                        props.on.change(row.channel, { days: v.map(Number).sort((a, b) => a - b) })
                                    }
                                />
                            </>
                        ) : null}
                    </Stack>
                </SurfaceCard>
            ))}
            <ContentCommandNote note={props.note} closeLabel={copy.close} onDismiss={props.on.dismissNote} />
            <Cluster gap="inline">
                <Button
                    isLoading={props.isLoading}
                    intent="alternative"
                    size="sm"
                    onPress={props.on.preset}
                    isDisabled={locked}
                >
                    {copy.cadencePreset}
                </Button>
                <Button
                    isLoading={props.isLoading}
                    intent="commit"
                    size="sm"
                    isPending={isPending}
                    isDisabled={!canManage}
                    onPress={props.on.save}
                >
                    {copy.cadenceSave}
                </Button>
            </Cluster>
        </>
    )
}
