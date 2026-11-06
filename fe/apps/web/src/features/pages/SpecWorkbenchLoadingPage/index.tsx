import type { ReactElement } from "react"
import { SpecWorkbenchLoadingPageBase } from "./component"

/** The workbench route while it loads: one skeleton for every module, with no pane grid (the spec decides the panes once it arrives). */
export const SpecWorkbenchLoadingPage = (): ReactElement => <SpecWorkbenchLoadingPageBase />
