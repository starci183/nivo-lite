import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsQuickImportProps = ShiftsSetupViews["quickImport"] & {
    readonly on: ShiftsSetupActions["quickImport"] | undefined
    readonly isLoading?: boolean
}
import { Button, SurfaceCard, Text, Textarea, Stack, Cluster } from "@starci/grammar/common"

/** Draws the three text areas of the quick import and the create button. */
export const ShiftsQuickImport = (props: ShiftsQuickImportProps) => (
    <Stack gap="section">
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.title}
            headingLevel={2}
        >
            <Stack gap="row">
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                    {props.hint}
                </Text>
                {props.fields.map((field) => (
                    <Textarea
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        key={field.id}
                        label={field.label}
                        description={field.hint}
                        placeholder={field.placeholder}
                        rows={field.rows}
                        value={props.form[field.id]}
                        onValueChange={(value) => props.on?.change(field.id, value)}
                    />
                ))}
                <Cluster gap="row">
                    <Button
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        intent="commit"
                        isPending={props.isBusy}
                        isDisabled={!props.canCreate}
                        {...(props.on === undefined ? {} : { onPress: props.on.create })}
                    >
                        {props.createLabel}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    </Stack>
)
