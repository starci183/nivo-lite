"use client";

import { nivoIconSource, type IconName } from "../Icon";
import { Icon } from "@starci/grammar/common";

import { Header, ListBox } from "@heroui/react";


/** The two rail presentations owned by the same keyboard navigation collection. */
export type SelectionListPresentation = "expanded" | "compact";

/** One destination owned by the single-selection navigation list. */
export type SelectionListItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly status?: string;
  readonly isDisabled?: boolean;
};

/** One labelled run inside the destination list. */
export type SelectionListGroup = {
  readonly id: string;
  readonly label?: string;
  readonly items: ReadonlyArray<SelectionListItem>;
};

/** Closed destination data consumed by {@link SelectionList}. */
export type SelectionListData = {
  readonly label: string;
  readonly selectedKey: string;
  readonly presentation?: SelectionListPresentation;
  readonly groups: ReadonlyArray<SelectionListGroup>;
};

/** Route activation reported to connected navigation code. */
export type SelectionListActions = {
  readonly activate?: (id: string) => void;
};

/** Props for the HeroUI-owned single-selection destination list. */
export type SelectionListProps = {readonly props: SelectionListData;readonly on?: SelectionListActions;readonly isLoading?: boolean;};

/** Draw grouped destinations with one controlled selected key and native keyboard traversal. */
export const SelectionList = (props: SelectionListProps) => SelectionListView(props);
const SelectionListView = ({ props, on }: SelectionListProps) => {
  const presentation = props.presentation ?? "expanded";
  const compact = presentation === "compact";

  return (
    <ListBox


      data-presentation={presentation}
      aria-label={props.label}
      selectionMode="single"
      selectedKeys={[props.selectedKey]}
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        const selected = keys.values().next().value;
        if (selected !== undefined) on?.activate?.(String(selected));
      }}
      className={compact ? "items-center gap-1 p-0" : "gap-1 p-0"}>
      
            {props.groups.map((group) =>
      <ListBox.Section
        key={group.id}
        id={group.id}
        className={compact ?
        "flex flex-col items-center gap-1 first:sticky first:top-0 first:z-10 first:bg-background first:pb-1" :
        "flex flex-col gap-1 first:sticky first:top-0 first:z-10 first:bg-background first:pb-1"
        }>
        
                    {group.label === undefined ? null :
        <Header className={compact ?
        "sr-only" :
        "px-2 pb-1 pt-3 text-xs font-medium text-muted"
        }>
                            {group.label}
                        </Header>
        }
                    {group.items.map((item) =>
        <ListBox.Item
          key={item.id}
          id={item.id}
          textValue={item.label}
          aria-label={item.label}
          isDisabled={item.isDisabled}
          className={compact ?
          "group flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground outline-none data-[disabled=true]:cursor-default data-[disabled=true]:opacity-50 data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent" :
          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-foreground outline-none data-[disabled=true]:cursor-default data-[disabled=true]:opacity-50 data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent data-[hovered=true]:bg-default data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
          }>
          
                            {compact ?
          <span
            aria-hidden="true"
            title={item.label}
            className="flex size-10 items-center justify-center rounded-full group-data-[hovered=true]:bg-default group-data-[selected=true]:bg-accent-soft group-data-[selected=true]:text-accent">
            
                                    <Icon source={nivoIconSource(item.icon, "leading")} usage="leading" />
                                </span> :

          <>
                                    <Icon source={nivoIconSource(item.icon, "leading")} usage="leading" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                                    {item.status === undefined ? null :
            <span className="shrink-0 text-xs text-muted">{item.status}</span>
            }
                                </>
          }
                        </ListBox.Item>
        )}
                </ListBox.Section>
      )}
        </ListBox>);

};

