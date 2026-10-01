import { nivoIconSource, type IconName } from "../../leaves/Icon";
import { Icon } from "@starci/grammar/common";
import { Dropdown, Header } from "@heroui/react"
import type { ReactNode } from "react"


/** Placement choices exposed without leaking vendor vocabulary. */
export type DropdownBranchPlacement = "bottom left" | "bottom right" | "top left" | "top right"
/** One product-owned menu action. */
export type DropdownBranchItemData<I extends string> = { readonly id: I; readonly label: string; readonly icon?: IconName; readonly isDisabled?: boolean; readonly tone?: "default" | "danger"; readonly showsIndicator?: boolean }
/** One semantic group in the dropdown. */
export type DropdownBranchSectionData<I extends string> = { readonly items: ReadonlyArray<DropdownBranchItemData<I>> }
/** Complete dropdown content. */
export type DropdownBranchData<I extends string> = { readonly label: string; readonly placement?: DropdownBranchPlacement; readonly sections: ReadonlyArray<DropdownBranchSectionData<I>>; readonly selectionMode?: "single"; readonly selectedId?: I }
/** Menu selection reported to the owner. */
export type DropdownBranchActions<I extends string> = { readonly action?: (id: I) => void }
/** Props for HeroUI dropdown mechanics. */
export type DropdownBranchProps<I extends string> = { readonly props: DropdownBranchData<I>; readonly on?: DropdownBranchActions<I>; readonly trigger: ReactNode; readonly header?: ReactNode }

/** Render a keyboard-accessible dropdown with grouped actions. */
export const DropdownBranch = <I extends string>(props: DropdownBranchProps<I>) => (
    <Dropdown>
        <Dropdown.Trigger aria-label={props.props.label}>{props.trigger}</Dropdown.Trigger>
        <Dropdown.Popover placement={props.props.placement ?? "bottom right"}>
            {props.header === undefined ? null : <Header>{props.header}</Header>}
            <Dropdown.Menu
                aria-label={props.props.label}
                selectionMode={props.props.selectionMode}
                selectedKeys={props.props.selectedId === undefined ? undefined : new Set([props.props.selectedId])}
            >
                {props.props.sections.map((section, index) => (
                    <Dropdown.Section key={"section-" + index}>
                        {section.items.map((item) => (
                            <Dropdown.Item key={item.id} id={item.id} textValue={item.label} isDisabled={item.isDisabled} onAction={() => props.on?.action?.(item.id)}>
                                {item.showsIndicator === true ? <Dropdown.ItemIndicator /> : null}
                                {item.icon === undefined ? null : <Icon source={nivoIconSource(item.icon, "leading")} usage="leading" />}
                                {item.label}
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Section>
                ))}
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown>
)
