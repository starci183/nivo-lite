"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { PRIMARY_GROUP_CLASS_NAME, ROOT_CLASS_NAME, SECONDARY_GROUP_CLASS_NAME } from "./classNames";

/** One text-only peer choice. */
export type ChoiceTabsItemData = {readonly id: string;readonly label: string;};
/** Resolved copy and selection for one fixed peer-choice control. */
export type ChoiceTabsData = {
  readonly label: string;
  readonly selectedKey: string;
  readonly tabs: ReadonlyArray<ChoiceTabsItemData>;
  readonly variant?: "primary" | "secondary";
};
/** Selection reported by the peer-choice control. */
export type ChoiceTabsActions = {readonly select?: (key: string) => void;};
/** Props for the peer-choice control. */
export type ChoiceTabsProps = {readonly props: ChoiceTabsData;readonly on?: ChoiceTabsActions;readonly isLoading?: boolean;};

/**
 * Text-only peer choices. Business categories do not gain decorative glyphs.
 *
 * This is a single-value mode switch, not an ARIA tab set: the selected mode's content is owned
 * and rendered by the parent block, so claiming a tabpanel here would point assistive technology
 * at content this leaf does not own. HeroUI's toggle group supplies the matching group, pressed,
 * focus and arrow-key behavior without inventing that relationship.
 */
export const ChoiceTabs = (props: ChoiceTabsProps) => ChoiceTabsView(props);
const ChoiceTabsView = ({ props, on }: ChoiceTabsProps) =>
<div className={ROOT_CLASS_NAME}>
        <ToggleButtonGroup
    aria-label={props.label}
    className={props.variant === "primary" ? PRIMARY_GROUP_CLASS_NAME : SECONDARY_GROUP_CLASS_NAME}
    fullWidth={props.variant === "primary"}
    isDetached
    selectedKeys={new Set([props.selectedKey])}
    selectionMode="single"
    disallowEmptySelection
    onSelectionChange={(keys) => {
      const key = [...keys][0];
      if (key !== undefined) on?.select?.(String(key));
    }}>
    
            {props.tabs.map((tab) =>
    <ToggleButton key={tab.id} id={tab.id} variant="ghost">
                    {tab.label}
                </ToggleButton>
    )}
        </ToggleButtonGroup>
    </div>;


