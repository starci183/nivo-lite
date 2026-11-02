import type { HiringViews, HiringActions } from "@/modules/types"

type HiringAvailabilitySettingsProps = HiringViews["availabilityFields"] & {
    readonly on: HiringActions["availabilityActions"]
    readonly isLoading: boolean
}
import { Stack, Grid, Cluster, Alert, Button, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"

/** Draws the card where each member says when they are free to interview, one weekday per line (in Vietnam time). */
export const HiringAvailabilitySettings = (props: HiringAvailabilitySettingsProps) => {
    const { copy, members, who, days, canSave, isBusy, error, notice } = props
    const { on } = props
    return (
        <SurfaceCard isLoading={props.isLoading} label={copy.availTitle}>
            <Stack gap="row">
                <Text isLoading={props.isLoading} size="sm" tone="muted">
                    {copy.availHint}
                </Text>
                {members.length === 0 ? (
                    <Text isLoading={props.isLoading} tone="muted">
                        {copy.availNoMembers}
                    </Text>
                ) : (
                    <>
                        <Select
                            isLoading={props.isLoading}
                            label={copy.availMember}
                            options={members}
                            value={who}
                            onValueChange={(id) => on.member(id ?? who)}
                        />
                        <Grid kind="form" columns={2}>
                            {days.map((day) => (
                                <Input
                                    isLoading={props.isLoading}
                                    key={`${who}-${day.weekday}`}
                                    id={`av-${day.weekday}`}
                                    name={`av_${day.weekday}`}
                                    label={day.label}
                                    placeholder={copy.availPlaceholder}
                                    isInvalid={day.isInvalid}
                                    errorMessage={day.isInvalid ? copy.availInvalid : undefined}
                                    value={day.text}
                                    onValueChange={(text) => on.text(day.weekday, text)}
                                />
                            ))}
                        </Grid>
                        {error === null ? null : (
                            <Alert tone="negative" title={copy.errorNotSaved} description={error} />
                        )}
                        {notice === null ? null : <Alert tone="affirmative" title={notice} />}
                        <Cluster gap="inline">
                            <Button
                                isLoading={props.isLoading}
                                intent="neutral"
                                isPending={isBusy}
                                isDisabled={isBusy || !canSave}
                                onPress={on.save}
                            >
                                {copy.availSave}
                            </Button>
                        </Cluster>
                    </>
                )}
            </Stack>
        </SurfaceCard>
    )
}
