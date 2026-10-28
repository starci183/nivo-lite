import { Alert, Button, Heading, Input, NumberField, SurfaceCard, Switch, Textarea } from "@starci/grammar/common"
import type { FieldOf, HiringSay } from "@/modules/types"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** The values of the settings form as the card draws them. */
export interface HiringSettingsValues {
    readonly publicSlug: string
    readonly retentionDays: number
    readonly applyConsentText: string
    readonly adTone: string
    readonly notifyNewCandidate: boolean
    readonly remindInterview: boolean
    readonly autoCloseWhenFilled: boolean
}

/** What the connected block settled for the settings card. */
export interface HiringSettingsBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly slugHint: string
        readonly values: HiringSettingsValues
        readonly retentionMin: number
        readonly retentionMax: number
        readonly isBusy: boolean
        readonly error: string | null
        readonly notice: string | null
    }
    readonly on: {
        readonly text: (name: FieldOf<HiringSettingsValues, string>, value: string) => void
        readonly number: (name: FieldOf<HiringSettingsValues, number>, value: number) => void
        readonly flag: (name: FieldOf<HiringSettingsValues, boolean>, value: boolean) => void
        readonly save: () => void
    }
}

/** Draws the settings tab: the public link, how long closed files are kept, what the agent does by itself and the consent text. */
export const HiringSettingsBase = (props: HiringSettingsBaseProps) => {
    const { say, slugHint, values, retentionMin, retentionMax, isBusy, error, notice } = props.props
    const { on } = props
    return (
        <>
            <Heading level={2}>{say("setTitle")}</Heading>
            <SurfaceCard label={say("setCardTitle")}>
                <div className={FORM_CLASS_NAME}>
                    <Input
                        id="st-slug"
                        name="slug"
                        label={say("setSlug")}
                        value={values.publicSlug}
                        onValueChange={(slug) => on.text("publicSlug", slug)}
                        description={slugHint}
                    />
                    <NumberField
                        label={say("setRetention")}
                        description={say("setRetentionHint")}
                        minValue={retentionMin}
                        maxValue={retentionMax}
                        step={1}
                        value={values.retentionDays}
                        onValueChange={(days) => on.number("retentionDays", Number.isFinite(days) ? days : 90)}
                    />
                    <Textarea
                        label={say("setConsent")}
                        rows={3}
                        maxLength={800}
                        value={values.applyConsentText}
                        onValueChange={(text) => on.text("applyConsentText", text)}
                    />
                    <Input
                        id="st-tone"
                        name="tone"
                        label={say("setTone")}
                        value={values.adTone}
                        onValueChange={(tone) => on.text("adTone", tone)}
                    />
                    <Switch
                        label={say("setNotify")}
                        description={say("setNotifyHint")}
                        isSelected={values.notifyNewCandidate}
                        onSelectedChange={(isOn) => on.flag("notifyNewCandidate", isOn)}
                    />
                    <Switch
                        label={say("setRemind")}
                        description={say("setRemindHint")}
                        isSelected={values.remindInterview}
                        onSelectedChange={(isOn) => on.flag("remindInterview", isOn)}
                    />
                    <Switch
                        label={say("setAutoClose")}
                        description={say("setAutoCloseHint")}
                        isSelected={values.autoCloseWhenFilled}
                        onSelectedChange={(isOn) => on.flag("autoCloseWhenFilled", isOn)}
                    />
                    {error === null ? null : <Alert tone="negative" title={say("errorNotSaved")} description={error} />}
                    {notice === null ? null : <Alert tone="affirmative" title={notice} />}
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button intent="commit" isPending={isBusy} isDisabled={isBusy} onPress={on.save}>
                            {say("setSave")}
                        </Button>
                    </div>
                </div>
            </SurfaceCard>
        </>
    )
}
