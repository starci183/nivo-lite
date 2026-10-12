/** TopBar brand slot: logo, workspace menu, role chip and founding badge on one line. */
export const BRAND = "flex min-w-0 items-center gap-3"

/** The workspace menu shows from sm; phones keep the logo and role only. */
export const WORKSPACE_NAME = "hidden min-w-0 sm:block"

/** Founding badge shows from sm. */
export const BADGE = "hidden sm:block"

/** TopBar actions: search, new, language, bell and account. */
export const ACTIONS = "flex min-w-0 items-center gap-2"

/** Search sits in the bar from lg; below that it leaves the row. */
export const SEARCH = "hidden w-full max-w-md lg:block"
