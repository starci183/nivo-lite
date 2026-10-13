import { Alert, Button, Input, NumberField, SectionHeader, SurfaceCard, Switch } from "@starci/grammar/common"
import type { ContentNote, ContentT } from "@/hooks/content"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One editable theme row. */
export interface PillarRow {
    /** A stable key of the row. */
    readonly key: string
    /** The saved id, absent for a row that is not saved yet. */
    readonly id?: string
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

/** Draws the content themes: name, what it covers, weight, in use, with add, remove, suggested themes and save. */
export const ContentPillarsCardBase = (props: ContentPillarsCardBaseProps) => {
    const { t, canManage, isPending } = props.props
    const locked = !canManage || isPending
    return (
        <SurfaceCard ariaLabel={t("settingsPillars")}>
            <div className={FORM_CLASS_NAME}>
                <SectionHeader level={2} title={t("settingsPillars")} description={t("settingsPillarsBody")} />
                {props.props.rows.map((row) => (
                    <div key={row.key} className={FORM_CLASS_NAME}>
                        <Input
                            id={`pillar-name-${row.key}`}
                            name={`pillar-name-${row.key}`}
                            label={t("pillarName")}
                            variant="secondary"
                            value={row.name}
                            isDisabled={locked}
                            onValueChange={(v) => props.on.change(row.key, { name: v })}
                        />
                        <Input
                            id={`pillar-desc-${row.key}`}
                            name={`pillar-desc-${row.key}`}
                            label={t("pillarDesc")}
                            variant="secondary"
                            value={row.description}
                            isDisabled={locked}
                            onValueChange={(v) => props.on.change(row.key, { description: v })}
                        />
                        <NumberField
                            variant="secondary"
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
                                variant="danger-soft"
                                size="sm"
                                isDisabled={locked}
                                onPress={() => props.on.remove(row.key)}
                            >
                                {t("remove")}
                            </Button>
                        </div>
                    </div>
                ))}
                {props.props.note ? (
                    <Alert
                        title={props.props.note.text}
                        tone={props.props.note.tone === "ok" ? "affirmative" : "negative"}
                        dismissLabel={t("close")}
                        onDismiss={props.on.dismissNote}
                    />
                ) : null}
                <div className={ACTIONS_CLASS_NAME}>
                    <Button variant="outline" size="sm" isDisabled={locked} onPress={props.on.add}>
                        {t("pillarAdd")}
                    </Button>
                    {props.props.rows.length === 0 ? (
                        <Button variant="secondary" size="sm" isDisabled={locked} onPress={props.on.preset}>
                            {t("pillarPreset")}
                        </Button>
                    ) : null}
                    <Button
                        variant="primary"
                        size="sm"
                        isPending={isPending}
                        isDisabled={!canManage}
                        onPress={props.on.save}
                    >
                        {t("pillarSave")}
                    </Button>
                </div>
            </div>
        </SurfaceCard>
    )
}
