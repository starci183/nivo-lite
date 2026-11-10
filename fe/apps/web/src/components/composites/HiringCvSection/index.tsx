import type { HiringViews } from "@/modules/types"

import { Button, Heading, Image, MediaFrame, Text, Cluster } from "@starci/grammar/common"
import { CV_FRAME_CLASS_NAME } from "./classNames"
/** The words and state of the CV section. */
interface HiringCvSectionProps {
    readonly copy: HiringViews["workbenchCopy"]
    readonly hasCv: boolean
    readonly isLoading: boolean
    readonly openLabel: string
    readonly url: string
    readonly isPdf: boolean
    readonly canPreview: boolean
    readonly isPreviewing: boolean
    readonly on: {
        readonly toggle: () => void
    }
}

/** The CV section of a candidate: a link to open it, and a preview of a PDF or an image. The link works for a few minutes only. */
export const HiringCvSection = (props: HiringCvSectionProps) => {
    const { copy, hasCv, openLabel, url, isPdf, canPreview, isPreviewing } = props
    return (
        <>
            <Heading isLoading={props.isLoading} level={3}>
                {copy.candCv}
            </Heading>
            {hasCv ? (
                <>
                    <Cluster gap="inline">
                        {canPreview ? (
                            <Button isLoading={props.isLoading} intent="neutral" size="sm" onPress={props.on.toggle}>
                                {isPreviewing ? copy.candCvHide : copy.candCvPreview}
                            </Button>
                        ) : null}
                        <Button endArrow
                            isLoading={props.isLoading}
                            intent="dismiss"
                            size="sm"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {openLabel}
                        </Button>
                    </Cluster>
                    {isPreviewing ? (
                        <MediaFrame
                            aspect="portrait"
                            fit="contain"
                            media={
                                isPdf ? (
                                    <iframe title={copy.candCv} src={url} className={CV_FRAME_CLASS_NAME} />
                                ) : (
                                    <Image src={url} alt={copy.candCv} fit="contain" />
                                )
                            }
                        />
                    ) : null}
                    <Text isLoading={props.isLoading} size="xs" tone="muted">
                        {copy.candCvExpires}
                    </Text>
                </>
            ) : (
                <Text isLoading={props.isLoading} tone="muted">
                    {copy.candCvNone}
                </Text>
            )}
        </>
    )
}
