import { skeletonVariants } from "@heroui/react";
import { DATE_CLASS_NAME, DOT_CLASS_NAME, LOADING_CLASS_NAME, ROOT_CLASS_NAME, WEEKDAY_CLASS_NAME } from "./classNames";

/**
 * LEAF - `DayCell`: one day of a streak, as a dot with its weekday letter.
 *
 * IT RENDERS AN `<li>` because a run of days IS a list, and the run that lays it out renders the
 * `<ul>`. The pair is held by the two files together - a leaf owns its own element, so there is no
 * third place for the tag to be decided and disagreed with.
 *
 * `title` IS READ AND NOT SEEN. The letter under the dot is one character and cannot say which
 * date it is; the full date is there for assistive technology and for nobody else.
 */

/** What this leaf draws. A `type`, not an `interface` - only an alias satisfies the data fence. */
export type DayCellData = {
  /** Identity of the column - the ISO date. Used as the key by whoever maps the run. */
  readonly id: string;
  /** Already-localized narrow weekday letter. Absent while loading. */
  readonly weekday?: string;
  /** Already-localized full date, read out by assistive technology. Absent while loading. */
  readonly title?: string;
  /** Whether the learner was active that day. */
  readonly active?: boolean;
};

/** Props for {@link DayCell}. Three fixed slots, no fourth - see {@link LeafProps}. */
export type DayCellProps = {readonly props: DayCellData;readonly isLoading?: boolean;};

/** Stacks the plain circle over its letter. */
/** The resting shape - same chip, glyphs out. */
const RESTING_CLASSES = skeletonVariants({ animationType: "shimmer" }).base({
  className: LOADING_CLASS_NAME
});

/**
 * Draw one day.
 *
 * @param input - {@link DayCellProps}
 */
export const DayCell = (props: DayCellProps) => DayCellView(props);
const DayCellView = ({ props, isLoading = false }: DayCellProps) => {
  const dotFill = props.active === true ? "bg-accent/80" : "bg-muted/20";
  const dotClasses = `${DOT_CLASS_NAME} ${isLoading ? RESTING_CLASSES : dotFill}`;
  return (
    <li


      data-part="day"
      data-active={props.active === true ? "true" : "false"}
      data-loading={isLoading ? "true" : "false"}
      className={ROOT_CLASS_NAME}>
      
            <span aria-hidden="true" className={dotClasses} />
            <span data-part="weekday" className={WEEKDAY_CLASS_NAME}>
                {props.weekday ?? ""}
            </span>
            <span data-part="date" className={DATE_CLASS_NAME}>
                {props.title ?? ""}
            </span>
        </li>);

};

