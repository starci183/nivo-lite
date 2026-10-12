import { motion } from "framer-motion";
import type { ComponentType, CSSProperties } from "react";
import { SCROLL_VIEWPORT_CLASS_NAME } from "./classNames";

/** Fixed content owned by the navigation scroll viewport. */
export type ScrollViewportProps<P extends object> = {
  readonly content: ComponentType<P>;
  readonly contentProps: P;
  readonly ariaLabel?: string;
};

const VIEWPORT_STYLE: CSSProperties = {
  minHeight: 0,
  flex: 1,
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "none"
};

/** Own the single contained vertical scroll region while keeping native scrollbar paint hidden. */
export const ScrollViewport = <P extends object,>(props: ScrollViewportProps<P>) => {
  const Content = props.content;
  return <motion.div
  aria-label={props.ariaLabel}

  tabIndex={0}
  layoutScroll
  style={VIEWPORT_STYLE}
  className={SCROLL_VIEWPORT_CLASS_NAME}>
  
        <Content {...props.contentProps} />
    </motion.div>;
};


