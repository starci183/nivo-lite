import { Switch } from "@starci/grammar/common"
import { nivoIconSource } from "../../leaves/Icon"

/** What the appearance switch draws and reports. */
type ThemeSwitchProps = {
    readonly isDark: boolean
    /** The name of the switch. */
    readonly label: string
    readonly onChange: (isDark: boolean) => void
}

/** The light/dark switch: the grammar switch, large (`lg`), with the sun on its thumb and the moon once dark is selected. */
export const ThemeSwitch = (props: ThemeSwitchProps) => (
    <Switch
        label={props.label}
        isLabelHidden
        size="lg"
        isSelected={props.isDark}
        onSelectedChange={props.onChange}
        thumbIcon={nivoIconSource("light", "leading")}
        selectedThumbIcon={nivoIconSource("dark", "leading")}
    />
)
