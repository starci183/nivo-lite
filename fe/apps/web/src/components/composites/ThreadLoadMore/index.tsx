import { Button, Stack, Text } from "@starci/grammar/common"
import type { WorkThreadBoardView } from "@/modules/types"

/** What the closing control of the threads list draws and asks. */
interface ThreadLoadMoreProps {
    readonly rail: WorkThreadBoardView["rail"]
    readonly onLoadMore: () => void
    readonly onRetryPage: () => void
}

/** The control that reads the next page of threads, or says that it failed and offers the retry in place. */
export const ThreadLoadMore = (props: ThreadLoadMoreProps) => {
    const { rail } = props
    if (!rail.hasNextPage && rail.paginationFailure === null) return null
    return (
        <Stack gap="inline" align="center">
            {rail.paginationFailure === null ? null : (
                <Text size="sm" live="polite">
                    {rail.paginationFailure}
                </Text>
            )}
            <Button
                intent="alternative"
                size="sm"
                isPending={rail.isLoadingMore}
                onPress={rail.paginationFailure === null ? props.onLoadMore : props.onRetryPage}
            >
                {rail.paginationFailure === null ? rail.loadMoreLabel : rail.retryPageLabel}
            </Button>
        </Stack>
    )
}
