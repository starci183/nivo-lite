import { ChoiceTabs, type ChoiceTabsData } from "../../leaves/ChoiceTabs";
import { ROOT_CLASS_NAME } from "./classNames";

/** Public DualTabsToolbarData declaration. */
export type DualTabsToolbarData = {readonly leading: ChoiceTabsData;readonly trailing: ChoiceTabsData;};
/** Public DualTabsToolbarActions declaration. */
export type DualTabsToolbarActions = {readonly selectLeading?: (key: string) => void;readonly selectTrailing?: (key: string) => void;};
/** Public DualTabsToolbarProps declaration. */
export type DualTabsToolbarProps = {readonly props: DualTabsToolbarData;readonly on?: DualTabsToolbarActions;readonly isLoading?: boolean;};

/** Public DualTabsToolbar declaration. */
export const DualTabsToolbar = (props: DualTabsToolbarProps) => DualTabsToolbarView(props);
const DualTabsToolbarView = ({ props, on }: DualTabsToolbarProps) =>
<div className={ROOT_CLASS_NAME}>
        <ChoiceTabs props={{ ...props.leading, variant: "primary" }} on={{ select: on?.selectLeading }} />
        <ChoiceTabs props={{ ...props.trailing, variant: "primary" }} on={{ select: on?.selectTrailing }} />
    </div>;
