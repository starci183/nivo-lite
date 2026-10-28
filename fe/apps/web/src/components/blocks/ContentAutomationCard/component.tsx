import { Alert, SectionHeader, SurfaceCard, Switch } from "@starci/grammar/common"
import type { ContentNoteView, ContentT } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

/** One automation switch. */
export interface AutomationRow {
    readonly key: string
    readonly title: string
    readonly body: string
    readonly on: boolean
}

/** What the automations card draws. */
export interface ContentAutomationCardBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly rows: ReadonlyArray<AutomationRow>
        readonly canManage: boolean
        readonly isPending: boolean
        readonly note: ContentNoteView | null
    }
    readonly on: {
        readonly toggle: (key: string, on: boolean) => void
        readonly dismissNote: () => void
    }
}

/** Draws the three automations as switches. They run in the back end; they only write Office messages and drafts, never post. */
export const ContentAutomationCardBase = (props: ContentAutomationCardBaseProps) => {
    const { t } = props.props
    return (
        <SurfaceCard ariaLabel={t("settingsAuto")}>
            <div className={FORM_CLASS_NAME}>
                <SectionHeader level={2} title={t("settingsAuto")} description={t("settingsAutoBody")} />
                {props.props.rows.map((row) => (
                    <Switch
                        key={row.key}
                        label={row.title}
                        description={row.body}
                        isSelected={row.on}
                        isDisabled={!props.props.canManage || props.props.isPending}
                        onSelectedChange={(v) => props.on.toggle(row.key, v)}
                    />
                ))}
                {props.props.note ? (
                    <Alert
                        title={props.props.note.text}
                        tone={props.props.note.tone === "ok" ? "affirmative" : "negative"}
                        dismissLabel={t("close")}
                        onDismiss={props.on.dismissNote}
                    />
                ) : null}
            </div>
        </SurfaceCard>
    )
}
