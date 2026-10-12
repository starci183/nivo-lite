"use client";

import { Tabs } from "@heroui/react";
import { cn } from "@heroui/react";
import { ROUTE_INDICATOR_CLASS_NAME, ROUTE_TAB_CLASS_NAME, ROUTE_TAB_LIST_CLASS_NAME, ROUTE_TABS_CLASS_NAME } from "./classNames";

/** One text-only destination in a routed or task-local navigation strip. */
export type RouteTabsItemData = {readonly id: string;readonly label: string;};

/** Resolved copy and controlled destination for one underlined tab strip. */
export type RouteTabsData = {
  readonly label: string;
  readonly selectedKey: string;
  readonly tabs: ReadonlyArray<RouteTabsItemData>;
};

/** The destination selected through the navigation strip. */
export type RouteTabsActions = {readonly select?: (key: string) => void;};

/** Closed props for the shared routed-tab leaf. */
export type RouteTabsProps = {readonly props: RouteTabsData;readonly on?: RouteTabsActions;readonly isLoading?: boolean;};

/** Draw a flat underlined navigation strip without exposing HeroUI anatomy to callers. */
export const RouteTabs = (props: RouteTabsProps) =>
<div className={ROUTE_TABS_CLASS_NAME}>
        <Tabs
    variant="secondary"
    selectedKey={props.props.selectedKey}
    onSelectionChange={(key) => props.on?.select?.(String(key))}
    className={cn("w-max", "min-w-full", "whitespace-nowrap")}>
    
            <Tabs.List aria-label={props.props.label} className={ROUTE_TAB_LIST_CLASS_NAME}>
                {props.props.tabs.map((tab) =>
      <Tabs.Tab key={tab.id} id={tab.id} className={ROUTE_TAB_CLASS_NAME}>
                        {tab.label}
                        <Tabs.Indicator className={ROUTE_INDICATOR_CLASS_NAME} />
                    </Tabs.Tab>
      )}
            </Tabs.List>
        </Tabs>
    </div>;


