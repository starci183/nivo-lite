import { Button, Input, NumberField, Switch } from "@starci/grammar/common"
import type { ContentNote } from "@/hooks/content"
import type { ContentT } from "@/modules/types"
import { ContentCommandNote, ContentSettingsCard } from "@/components/composites/ContentSettingsCard"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One editable theme row. */
export interface PillarRow {
    /** A stable key of the row. */
    readonly key: string
    /** The saved id, absent for a row that is not saved yet. */
    readonly id?: string | undefined
    readonly name: string
    readonly description: string
    readonly weight: number
    readonly active: boolean
}

/** What the themes card draws. */
export interface ContentPillarsCardBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly rows: ReadonlyArray<PillarRow>
        readonly canManage: boolean
        readonly isPending: boolean
        readonly note: ContentNote | null
    }
    readonly on: {
        readonly change: (key: string, change: Partial<PillarRow>) => void
        readonly add: () => void
        readonly remove: (key: string) => void
        readonly preset: () => void
        readonly save: () => void
        readonly dismissNote: () => void
    }
}

interface PillarTextFieldProps {
    readonly row: PillarRow
    readonly field: "name" | "description"
    readonly label: string
    readonly locked: boolean
    readonly onChange: ContentPillarsCardBaseProps["on"]["change"]
}

const PillarTextField = (props: PillarTextFieldProps) => {
    const id = `pillar-${props.field === "name" ? "name" : "desc"}-${props.row.key}`
    return (
        <Input
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
export const ContentPillarsCardBase = (props: ContentPillarsCardBaseProps) => {
    const { t, canManage, isPending } = props.props
    const locked = !canManage || isPending
    return (
        <ContentSettingsCard title={t("settingsPillars")} description={t("settingsPillarsBody")}>
            {props.props.rows.map((row) => (
                <div key={row.key} className={FORM_CLASS_NAME}>
                    <PillarTextField
                        row={row}
                        field="name"
                        label={t("pillarName")}
                        locked={locked}
                        onChange={props.on.change}
                    />
                    <PillarTextField
                        row={row}
                        field="description"
                        label={t("pillarDesc")}
                        locked={locked}
                        onChange={props.on.change}
                    />
                    <NumberField
                        label={t("pillarWeight")}
                        value={row.weight}
                        minValue={0}
                        maxValue={20}
                        isDisabled={locked}
                        onValueChange={(v) => props.on.change(row.key, { weight: v })}
                    />
                    <div className={ACTIONS_CLASS_NAME}>
                        <Switch
                            label={t("pillarActive")}
                            isSelected={row.active}
                            isDisabled={locked}
                            onSelectedChange={(v) => props.on.change(row.key, { active: v })}
                        />
                        <Button
                            intent="destructive"
                            step="entry"
                            isDisabled={locked}
                            onPress={() => props.on.remove(row.key)}
                        >
                            {t("remove")}
                        </Button>
                    </div>
                </div>
            ))}
            <ContentCommandNote note={props.props.note} closeLabel={t("close")} onDismiss={props.on.dismissNote} />
            <div className={ACTIONS_CLASS_NAME}>
                <Button intent="neutral" size="sm" isDisabled={locked} onPress={props.on.add}>
                    {t("pillarAdd")}
                </Button>
                {props.props.rows.length === 0 ? (
                    <Button intent="alternative" size="sm" isDisabled={locked} onPress={props.on.preset}>
                        {t("pillarPreset")}
                    </Button>
                ) : null}
                <Button intent="commit" size="sm" onPress={props.on.save} isDisabled={!canManage} isPending={isPending}>
                    {t("pillarSave")}
                </Button>
            </div>
        </ContentSettingsCard>
    )
}
