import { nivoIconSource, type IconName } from "../Icon";
import { Icon } from "@starci/grammar/common";
import { Link as HeroLink } from "@heroui/react";


/**
 * LEAF - `QuickActionRow`: one shortcut on the rail.
 *
 * One navigation control. Its glyph is intrinsic to that single target, like a Button's icon;
 * it does not introduce a second independently actionable value.
 *
 * THE WHOLE ROW IS THE TARGET, not the words inside it. A rail of shortcuts is scanned and aimed
 * at quickly, and a target the width of its own label is a target that gets missed - so the row
 * carries the inset and the hover rather than the text.
 *
 * THE GLYPH TAKES THE ROW'S OWN COLOUR. An icon with a colour of its own is the one still bright
 * after the row it sits in turns muted.
 */

/** What this leaf draws. A `type`, not an `interface` - only an alias satisfies the data fence. */
export type QuickActionRowData = {
  /** Identity of the row, used as the key by whoever maps the rail. */
  readonly id: string;
  /** The already-resolved words. */
  readonly label: string;
  /** The meaning drawn before the words. */
  readonly icon: IconName;
};

/** Shortcut choice reported to the connected routing owner. */
export type QuickActionRowActions = {
  readonly press?: () => void;
};

/** Props for {@link QuickActionRow}. Three fixed slots, no fourth - see {@link LeafProps}. */
export type QuickActionRowProps = {readonly props: QuickActionRowData;readonly on?: QuickActionRowActions;readonly isLoading?: boolean;};

/** The row is the target: it carries the inset, the radius and the hover. */
const ROW_CLASSES = "flex flex-row items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-default";

/**
 * Draw one shortcut.
 *
 * @param input - {@link QuickActionRowProps}
 */
export const QuickActionRow = (props: QuickActionRowProps) => QuickActionRowView(props);
const QuickActionRowView = ({ props, on }: QuickActionRowProps) =>
<HeroLink


  data-part="quick-action"
  onPress={on?.press}
  className={ROW_CLASSES}>
  
        <Icon source={nivoIconSource(props.icon, "leading")} usage="leading" />
        {props.label}
    </HeroLink>;


