import { nivoIconSource } from "../Icon";
import { Icon } from "@starci/grammar/common";
import { Input as HeroInput } from "@heroui/react";


/**
 * LEAF - `SearchBox`: the one field that lives in the bar.
 *
 * One search control - its glyph and keyboard hint are intrinsic affordances, so it owns
 * the seam between them.
 *
 * THE SHORTCUT IS SHOWN, not merely bound. A reader who does not know the key never presses it, so
 * printing it in the field is the only thing that makes the shortcut exist for anyone but its
 * author. It is drawn as a hint rather than a control, because it is a fact about the keyboard and
 * not a thing to click.
 *
 * IT IS UNCONTROLLED like every other box. Search runs on submit, and a field that re-rendered the
 * whole bar on each keystroke would repaint the navigation while somebody typed.
 */

/** What this leaf draws. A `type`, not an `interface` - only an alias satisfies the data fence. */
export type SearchBoxData = {
  /** The already-resolved prompt shown in an empty box. */
  readonly placeholder: string;
  /** The already-resolved accessible name. Read, never seen. */
  readonly label: string;
  /** The keyboard shortcut, already written the way a reader would press it. */
  readonly shortcut?: string;
};

/** What searching does. */
export type SearchBoxActions = {
  /** Called with the query when the reader submits. */
  readonly search?: (query: string) => void;
};

/** Props for {@link SearchBox}. Three fixed slots, no fourth - see {@link LeafProps}. */
export type SearchBoxProps = {readonly props: SearchBoxData;readonly on?: SearchBoxActions;readonly isLoading?: boolean;};

/** The glyph leads, the box takes the slack, the hint trails inside the same well. */
const BOX_CLASSES = "flex flex-row items-center gap-2 rounded-full bg-default px-3 py-2 w-full max-w-xs";

/** The hint is set as a key, not as a word. */
const SHORTCUT_CLASSES = "shrink-0 rounded border px-2 py-1 text-xs text-muted";

/**
 * Draw the search field.
 *
 * @param input - {@link SearchBoxProps}
 */
export const SearchBox = (props: SearchBoxProps) => SearchBoxView(props);
const SearchBoxView = ({ props, on }: SearchBoxProps) =>
<form


  role="search"
  className={BOX_CLASSES}
  onSubmit={(event) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("q");
    on?.search?.(field instanceof HTMLInputElement ? field.value : "");
  }}>
  
        <Icon source={nivoIconSource("search", "chip")} usage="chip" />
        <HeroInput
    name="q"
    type="search"
    aria-label={props.label}
    placeholder={props.placeholder}
    fullWidth />
  
        {props.shortcut === undefined ? null :
  <kbd className={SHORTCUT_CLASSES}>{props.shortcut}</kbd>
  }
    </form>;


