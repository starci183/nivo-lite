import { motion } from "framer-motion"
import type { ComponentType } from "react"
import { DASHBOARD_THEME_CLASS_NAME } from "./classNames"

/** Content and props rendered inside the dashboard theme boundary. */
export type StarCiDashboardThemeBoundaryProps<P extends object> = { readonly content: ComponentType<P>; readonly contentProps: P }

/** Bind dashboard content to the shared visual theme. */
export const StarCiDashboardThemeBoundary = <P extends object>(props: StarCiDashboardThemeBoundaryProps<P>) => (
    <motion.div className={DASHBOARD_THEME_CLASS_NAME}>
        <props.content {...props.contentProps} />
    </motion.div>
)
