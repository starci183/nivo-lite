"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactionType } from "./reaction-type";

/** One product reaction offered by the picker. */
export type ReactionPickerChoiceData = {
  readonly id: ReactionType;
  readonly label: string;
};

/** Exact checked-in Fluent Emoji asset for one product reaction. */
const reactionAsset = (type: ReactionType): string => `/reactions/${type}.svg`;

/** Optical size for one reaction asset, owned by its placement. */
type ReactionImageProps = {
  readonly type: ReactionType;
  readonly size: "summary" | "picker";
};

/** Draw one reaction asset at the optical size owned by its placement. */
const ReactionImage = ({ type, size }: ReactionImageProps) =>
<img
  src={reactionAsset(type)}
  alt=""
  aria-hidden
  draggable={false}
  className={cn("inline-block shrink-0 select-none", size === "picker" ? "size-7" : "size-4")} />;



/** Settled reaction state for one activity. */
export type ReactionPickerData = {
  readonly label: string;
  readonly count: number;
  readonly selected?: ReactionType | null;
  readonly choices: ReadonlyArray<ReactionPickerChoiceData>;
  readonly isPending?: boolean;
};

/** A selected reaction, or `null` when the current reaction is removed. */
export type ReactionPickerActions = {readonly select?: (type: ReactionType | null) => void;};
/** Props for the intrinsic six-reaction control. */
export type ReactionPickerProps = {readonly props: ReactionPickerData;readonly on?: ReactionPickerActions;readonly isLoading?: boolean;};

const PICKER_VARIANTS = {
  hidden: { opacity: 0, y: 8, scale: 0.8 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 500, damping: 30, staggerChildren: 0.03 } },
  exit: { opacity: 0, y: 8, scale: 0.8, transition: { duration: 0.12 } }
} as const;
const CHOICE_VARIANTS = {
  hidden: { opacity: 0, y: 6, scale: 0.5 },
  visible: { opacity: 1, y: 0, scale: 1 }
} as const;

/** Legacy-faithful controlled reaction trigger and six-choice picker. */
export const ReactionPicker = (props: ReactionPickerProps) => ReactionPickerView(props);
const ReactionPickerView = ({ props, on }: ReactionPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedChoice = props.choices.find((choice): boolean => choice.id === props.selected);

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (on?.select === undefined) {
    if (props.count <= 0) return null;
    return <div className="flex items-center gap-1 text-xs text-muted">
            {selectedChoice === undefined ? null : <ReactionImage type={selectedChoice.id} size="summary" />}
            <span>{props.count}</span>
        </div>;
  }

  const select = (type: ReactionType) => {
    on.select?.(props.selected === type ? null : type);
    setIsOpen(false);
  };

  return <div ref={rootRef} className="relative flex items-center">
        <button
      type="button"
      aria-label={props.label}
      aria-expanded={isOpen}
      disabled={props.isPending === true}
      onClick={() => setIsOpen((current) => !current)}
      className="flex items-center gap-1 rounded-full px-2 py-0 text-xs text-muted transition-colors hover:bg-default/40 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      
            {selectedChoice === undefined ? <span>{props.label}</span> : <ReactionImage type={selectedChoice.id} size="summary" />}
            {props.count > 0 ? <span>{props.count}</span> : null}
        </button>
        <AnimatePresence>
            {isOpen ? <motion.div
        variants={PICKER_VARIANTS}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ transformOrigin: "bottom left" }}
        className="absolute bottom-full left-0 z-10 mb-1 flex items-center gap-1 rounded-full bg-surface p-1 ring-1 ring-separator">
        
                {props.choices.map((choice) => <motion.button
          key={choice.id}
          type="button"
          aria-label={choice.label}
          variants={CHOICE_VARIANTS}
          whileHover={{ scale: 1.4, y: -4 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          onClick={() => select(choice.id)}
          className={cn(
            "group/reaction relative flex items-center justify-center rounded-full p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            props.selected === choice.id && "bg-accent-soft"
          )}>
          
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-2 text-[10px] font-medium text-background opacity-0 transition-opacity group-hover/reaction:opacity-100">
                        {choice.label}
                    </span>
                    <ReactionImage type={choice.id} size="picker" />
                </motion.button>)}
            </motion.div> : null}
        </AnimatePresence>
    </div>;
};

