"use client";

import { nivoIconSource, type IconName } from "../Icon";
import { Icon } from "@starci/grammar/common";

import { ListBox } from "@heroui/react";


/** One destination in the legacy quick-access ListBox. */
export type QuickActionItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
};

/** Resolved copy and items for the quick-access ListBox. */
export type QuickActionsListData = {
  readonly label: string;
  readonly items: ReadonlyArray<QuickActionItem>;
};

/** Selection reported by the quick-access ListBox. */
export type QuickActionsListActions = {
  readonly activate?: (id: string) => void;
};

/** Fixed data and action slots for the quick-access ListBox. */
export type QuickActionsListProps = {readonly props: QuickActionsListData;readonly on?: QuickActionsListActions;readonly isLoading?: boolean;};

/** Draw the original native HeroUI ListBox chrome used by the legacy dashboard rail. */
export const QuickActionsList = (props: QuickActionsListProps) => QuickActionsListView(props);
const QuickActionsListView = ({ props, on }: QuickActionsListProps) =>
<ListBox


  aria-label={props.label}
  selectionMode="none"
  onAction={(key) => on?.activate?.(String(key))}
  className="gap-1 p-0">
  
        {props.items.map((item) =>
  <ListBox.Item
    key={item.id}
    id={item.id}
    textValue={item.label}
    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-foreground outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent data-[hovered=true]:bg-default">
    
                <Icon source={nivoIconSource(item.icon, "leading")} usage="leading" />
                <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
            </ListBox.Item>
  )}
    </ListBox>;


