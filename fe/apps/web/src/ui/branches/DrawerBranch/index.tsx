"use client";

import { Drawer } from "@heroui/react";
import { useState, type ComponentType, type ReactNode } from "react";

type DrawerBranchContent<P extends object> =
  | {
      readonly content: ComponentType<P>;
      readonly contentProps: P;
      readonly renderContent?: never;
    }
  | {
      readonly content?: never;
      readonly contentProps?: never;
      /** Render action-aware content that may close the drawer after a successful command. */
      readonly renderContent: (close: () => void) => ReactNode;
    };

/** Fixed copy and content owned by the right-edge drawer mechanic. */
export type DrawerBranchProps<P extends object = Record<string, never>> = {
  readonly triggerLabel: string;
  readonly title: string;
  readonly closeLabel: string;
} & DrawerBranchContent<P>;

/** Own HeroUI drawer placement, focus, dismissal, backdrop and the single scroll body. */
export const DrawerBranch = <P extends object,>(props: DrawerBranchProps<P>) => {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const content = props.renderContent === undefined
    ? <props.content {...props.contentProps} />
    : props.renderContent(close);
  return <Drawer.Root isOpen={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Trigger className="min-h-10 rounded-lg px-3 text-sm font-semibold text-foreground outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent">
            {props.triggerLabel}
        </Drawer.Trigger>
        <Drawer.Backdrop isDismissable>
            <Drawer.Content placement="right">
                <Drawer.Dialog>
                    <Drawer.Header className="border-b border-separator px-4 py-4">
                        <Drawer.Heading className="text-lg font-semibold text-foreground">{props.title}</Drawer.Heading>
                        <Drawer.CloseTrigger className="min-h-10 rounded-lg px-3 text-sm font-semibold text-foreground outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent">
                            {props.closeLabel}
                        </Drawer.CloseTrigger>
                    </Drawer.Header>
                    <Drawer.Body className="p-0">{content}</Drawer.Body>
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    </Drawer.Root>;
};


