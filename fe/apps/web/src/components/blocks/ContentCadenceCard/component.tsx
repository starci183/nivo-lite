import {
    Alert,
    Button,
    CheckboxGroup,
    Input,
    NumberField,
    SectionHeader,
    SurfaceCard,
    Switch,
} from "@starci/grammar/common"
import type { ContentChannel, ContentNote, ContentT } from "@/hooks/content"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One channel row of the posting rhythm. */
export interface CadenceRow {
    readonly channel: ContentChannel
    readonly label: string
    readonly on: boolean
    readonly perWeek: number
    readonly days: ReadonlyArray<number>
    readonly time: string
}

/** What the posting rhythm card draws. */
export interface ContentCadenceCardBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly rows: ReadonlyArray<CadenceRow>
        readonly dayNames: ReadonlyArray<string>
        readonly canManage: boolean
        readonly isPending: boolean
        readonly note: ContentNote | null
    }
    readonly on: {
        readonly change: (channel: ContentChannel, change: Partial<CadenceRow>) => void
        readonly preset: () => void
        readonly save: () => void
        readonly dismissNote: () => void
    }
}

/** Draws the posting rhythm: per channel the posts per week, the weekdays and the time (Vietnam time). */
export const ContentCadenceCardBase = (props: ContentCadenceCardBaseProps) => {
    const { t, canManage, isPending } = props.props
    const locked = !canManage || isPending
    return (
        <SurfaceCard ariaLabel={t("settingsCadence")}>
            <div className={FORM_CLASS_NAME}>
                <SectionHeader level={2} title={t("settingsCadence")} description={t("settingsCadenceBody")} />
                {props.props.rows.map((row) => (
                    <SurfaceCard key={row.channel} depth="nested" ariaLabel={row.label}>
                        <div className={FORM_CLASS_NAME}>
                            <Switch
                                label={`${t("cadenceOn")}: ${row.label}`}
                                isSelected={row.on}
                                isDisabled={locked}
                                onSelectedChange={(v) => props.on.change(row.channel, { on: v })}
                            />
                            {row.on ? (
                                <>
                                    <NumberField
                                        variant="secondary"
                                        label={t("cadencePerWeek")}
                                        value={row.perWeek}
                                        minValue={1}
                                        maxValue={21}
                                        isDisabled={locked}
                                        onValueChange={(v) => props.on.change(row.channel, { perWeek: v })}
                                    />
                                    <Input
                                        id={`cad-time-${row.channel}`}
                                        name={`cad-time-${row.channel}`}
                                        label={t("cadenceTime")}
                                        variant="secondary"
                                        value={row.time}
                                        hint={t("addTimeHint")}
                                        isDisabled={locked}
                                        onValueChange={(v) => props.on.change(row.channel, { time: v })}
                                    />
                                    <CheckboxGroup
                                        label={t("cadenceDays")}
                                        orientation="horizontal"
                                        variant="secondary"
                                        isDisabled={locked}
                                        options={props.props.dayNames.map((d, k) => ({
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
                        </div>
                    </SurfaceCard>
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
                    <Button variant="secondary" size="sm" isDisabled={locked} onPress={props.on.preset}>
                        {t("cadencePreset")}
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        isPending={isPending}
                        isDisabled={!canManage}
                        onPress={props.on.save}
                    >
                        {t("cadenceSave")}
                    </Button>
                </div>
            </div>
        </SurfaceCard>
    )
}
