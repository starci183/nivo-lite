"use client";

import { nivoIconSource, type IconName } from "../Icon";
import { Icon } from "@starci/grammar/common";

import { Tabs } from "@heroui/react";


/** One tab in the legacy dashboard strip. */
export type ExtendedTab = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
};

/** The controlled data accepted by the closed StarCi tab primitive. */
export type ExtendedTabsData = {
  readonly label: string;
  readonly selectedKey: string;
  readonly tabs: ReadonlyArray<ExtendedTab>;
};

/** Events reported by the tab primitive. */
export type ExtendedTabsActions = {
  readonly select?: (key: string) => void;
};

/** Fixed data and actions accepted by the closed StarCi tab leaf. */
export type ExtendedTabsProps = {readonly props: ExtendedTabsData;readonly on?: ExtendedTabsActions;readonly isLoading?: boolean;};

/**
 * The original StarCi `ExtendedTabs` rendering, closed over typed tab data.
 *
 * The old public `children` hole is deliberately replaced by `tabs`: the HeroUI compound anatomy,
 * secondary variant, icon sizing and indicator are still the legacy implementation, while callers
 * can no longer replace that anatomy with arbitrary markup.
 */
export const ExtendedTabs = (props: ExtendedTabsProps) => ExtendedTabsView(props);
const ExtendedTabsView = ({ props, on }: ExtendedTabsProps) =>
<div className="w-full px-6">
        <Tabs
    variant="secondary"
    selectedKey={props.selectedKey}
    onSelectionChange={(key) => on?.select?.(String(key))}
    className="extended-tabs whitespace-nowrap">
    
            <Tabs.ListContainer>
                <Tabs.List aria-label={props.label}>
                    {props.tabs.map((tab) =>
        <Tabs.Tab
          key={tab.id}
          id={tab.id}
          aria-controls={`dashboard-panel-${tab.id}`}>
          
                            <span className="flex items-center gap-2">
                                <Icon source={nivoIconSource(tab.icon, "leading")} usage="leading" />
                                <span className="hidden md:inline">{tab.label}</span>
                            </span>
                            <Tabs.Indicator />
                        </Tabs.Tab>
        )}
                </Tabs.List>
            </Tabs.ListContainer>
        </Tabs>
    </div>;


