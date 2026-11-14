import type { ReactElement } from "react"
import { Stack } from "@starci/grammar/common"
import { ConnectionsHome } from "@/components/blocks/ConnectionsHome"
import { WebsiteChannel } from "@/components/blocks/WebsiteChannel"

/** The Connected tab while the route loads, under the band its layout draws: the blocks of the page draw their own skeletons. */
export const ConnectionsLoadingPage = (): ReactElement => (
    <Stack gap="region">
        <ConnectionsHome />
        <WebsiteChannel />
    </Stack>
)
