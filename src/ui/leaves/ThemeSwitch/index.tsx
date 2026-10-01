import { nivoIconSource } from "../Icon";
import { Icon } from "@starci/grammar/common";
import { Switch } from "@heroui/react";

import { THEME_SWITCH_CLASS_NAME } from "./classNames";

/** Current appearance and accessible copy for the navbar switch. */
export type ThemeSwitchData = {
  readonly isDark: boolean;
  readonly label: string;
};

/** What changing the appearance switch reports. */
export type ThemeSwitchActions = {
  readonly change?: (isDark: boolean) => void;
};

/** Fixed props for the light/dark switch. */
export type ThemeSwitchProps = {readonly props: ThemeSwitchData;readonly on?: ThemeSwitchActions;readonly isLoading?: boolean;};

/** Draw the same native HeroUI switch used by the legacy navbar. */
export const ThemeSwitch = (props: ThemeSwitchProps) =>
<Switch


  isSelected={props.props.isDark}
  onChange={props.on?.change}
  aria-label={props.props.label}
  className={THEME_SWITCH_CLASS_NAME}>
  
        {({ isSelected }) =>
  <Switch.Content>
                <Switch.Control>
                    <Switch.Thumb>
                        <Switch.Icon>
                            <Icon source={nivoIconSource(isSelected ? "dark" : "light", "leading")} usage="leading" />
                        </Switch.Icon>
                    </Switch.Thumb>
                </Switch.Control>
            </Switch.Content>
  }
    </Switch>;


