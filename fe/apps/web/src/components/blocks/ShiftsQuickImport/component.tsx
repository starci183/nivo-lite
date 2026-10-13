import { Button, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { BLOCK_CLASS_NAME, PANEL_CLASS_NAME, ROW_CLASS_NAME } from "./classNames"

/** The three lists a manager can type. */
export type ImportField = "positions" | "staff" | "coverage"

/** What is typed in the three lists. */
export interface ImportForm {
    readonly positions: string
    readonly staff: string
    readonly coverage: string
}

/** Copy and state the connected quick import supplies. */
export interface ShiftsQuickImportBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly createLabel: string
        readonly fields: ReadonlyArray<{
            readonly id: ImportField
            readonly label: string
            readonly hint: string
            readonly placeholder: string
            readonly rows: number
        }>
        readonly form: ImportForm
        readonly isBusy: boolean
        readonly canCreate: boolean
    }
    readonly on: {
        readonly change: (field: ImportField, value: string) => void
        readonly create: () => void
    }
}

/** Draws the three text areas of the quick import and the create button. */
export const ShiftsQuickImportBase = (props: ShiftsQuickImportBaseProps) => (
    <div className={PANEL_CLASS_NAME}>
        <SurfaceCard label={props.props.title} headingLevel={2}>
            <div className={BLOCK_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {props.props.hint}
                </Text>
                {props.props.fields.map((field) => (
                    <Textarea
                        key={field.id}
                        label={field.label}
                        description={field.hint}
                        placeholder={field.placeholder}
                        rows={field.rows}
                        value={props.props.form[field.id]}
                        onValueChange={(value) => props.on.change(field.id, value)}
                    />
                ))}
                <div className={ROW_CLASS_NAME}>
                    <Button
                        variant="primary"
                        isPending={props.props.isBusy}
                        isDisabled={!props.props.canCreate}
                        onPress={props.on.create}
                    >
                        {props.props.createLabel}
                    </Button>
                </div>
            </div>
        </SurfaceCard>
    </div>
)
