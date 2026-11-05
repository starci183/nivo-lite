import type { ReactElement } from "react"
import { InboxFeed } from "@/components/blocks/InboxFeed"

/** The same panes while the route loads: the block draws its own skeletons. */
export const InboxLoadingPage = (): ReactElement => <InboxFeed />
