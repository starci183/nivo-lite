import { cn } from "@heroui/react";

/** Classes for the routed tab strip viewport. */
export const ROUTE_TABS_CLASS_NAME = cn("w-full", "min-w-0", "overflow-x-auto", "[scrollbar-width:none]", "[&::-webkit-scrollbar]:hidden");

/** Classes for the routed tab list. */
export const ROUTE_TAB_LIST_CLASS_NAME = cn("w-max", "min-w-full", "border-b", "border-border", "p-0", "max-sm:w-full");

/** Classes for each routed tab. */
export const ROUTE_TAB_CLASS_NAME = cn("rounded-none", "data-[selected=true]:text-foreground", "max-sm:min-h-11", "max-sm:min-w-0", "max-sm:flex-1", "max-sm:px-1", "max-sm:text-sm");

/** Classes for the routed tab indicator. */
export const ROUTE_INDICATOR_CLASS_NAME = cn("top-auto", "bottom-0", "h-1", "rounded-none", "bg-accent", "shadow-none");
