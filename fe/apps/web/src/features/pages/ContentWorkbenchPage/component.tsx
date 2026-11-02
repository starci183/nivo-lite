import { ContentWorkbench } from "@/components/blocks/ContentWorkbench"
/** Server-resolved route identity and the original five tab names. */
export interface ContentWorkbenchPageBaseProps {
    readonly props: Parameters<typeof ContentWorkbench>[0]
}
/** The server page composes one actual module world, without rendered nodes crossing its Base. */
export const ContentWorkbenchPageBase = (props: ContentWorkbenchPageBaseProps) => <ContentWorkbench {...props.props} />
