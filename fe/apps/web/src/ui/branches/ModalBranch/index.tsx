"use client";

import { Modal } from "@heroui/react";
import type { ComponentType } from "react";

/** Copy and content owned by the centered, controlled modal mechanic. */
export type ModalBranchProps<P extends object> = {
  readonly isOpen: boolean;
  readonly title: string;
  readonly closeLabel: string;
  readonly content: ComponentType<P>;
  readonly contentProps: P;
  readonly onDismiss: () => void;
};

/** Own modal focus, dismissal, backdrop and the single scrolling body. */
export const ModalBranch = <P extends object,>({ isOpen, title, closeLabel, content: Content, contentProps, onDismiss }: ModalBranchProps<P>) =>
<Modal.Root isOpen={isOpen} onOpenChange={(open) => {if (!open) onDismiss();}}>
        <Modal.Trigger className="hidden" aria-hidden="true" tabIndex={-1} />
        <Modal.Backdrop isDismissable>
            <Modal.Container placement="center" scroll="inside" size="md">
                <Modal.Dialog>
                    <Modal.Header className="border-b border-separator px-4 py-4">
                        <Modal.Heading className="text-lg font-semibold text-foreground">{title}</Modal.Heading>
                        <Modal.CloseTrigger aria-label={closeLabel} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-foreground outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent">
                            {closeLabel}
                        </Modal.CloseTrigger>
                    </Modal.Header>
                    <Modal.Body className="p-0"><Content {...contentProps} /></Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    </Modal.Root>;


