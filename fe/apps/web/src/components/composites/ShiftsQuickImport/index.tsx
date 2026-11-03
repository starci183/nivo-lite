import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsQuickImportProps = ShiftsSetupViews["quickImport"] & {
    readonly on: ShiftsSetupActions["quickImport"] | undefined
    readonly isLoading?: boolean
}
import { Textarea, Stack, Cluster } from "@starci/grammar/common"
import { ShiftsSetupCard } from "@/components/branches/ShiftsSetupCard"
import { ShiftsActionButton } from "@/components/leaves/ShiftsActionButton"

/** Draws the three text areas of the quick import and the create button. */
export const ShiftsQuickImport = (props: ShiftsQuickImportProps) => (
    <Stack gap="section">
        <ShiftsSetupCard
            title={props.title}
            hint={props.hint}
            isLoading={props.isLoading}
            body={
                <>
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
                        <ShiftsActionButton
                            isLoading={props.isLoading}
                            intent="commit"
                            isPending={props.isBusy}
                            isDisabled={!props.canCreate}
                            onPress={props.on?.create}
                            label={props.createLabel}
                        />
                    </Cluster>
                </>
            }
        />
    </Stack>
)
