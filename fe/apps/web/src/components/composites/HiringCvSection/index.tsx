import { Button, Heading, Image, MediaFrame, Text } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import { ACTIONS_CLASS_NAME, CV_FRAME_CLASS_NAME } from "./classNames"

/** The words and state of the CV section. */
export interface HiringCvSectionProps {
    readonly props: {
        readonly say: HiringSay
        readonly state: "none" | "loading" | "ready"
        readonly openLabel: string
        readonly url: string
        readonly isPdf: boolean
        readonly canPreview: boolean
        readonly isPreviewing: boolean
    }
    readonly on: {
        readonly toggle: () => void
    }
}

/** The CV section of a candidate: a link to open it, and a preview of a PDF or an image. The link works for a few minutes only. */
export const HiringCvSection = (props: HiringCvSectionProps) => {
    const { say, state, openLabel, url, isPdf, canPreview, isPreviewing } = props.props
    return (
        <>
            <Heading level={3}>{say("candCv")}</Heading>
            {state === "ready" ? (
                <>
                    <div className={ACTIONS_CLASS_NAME}>
                        {canPreview ? (
                            <Button variant="secondary" size="sm" onPress={props.on.toggle}>
                                {say(isPreviewing ? "candCvHide" : "candCvPreview")}
                            </Button>
                        ) : null}
                        <Button variant="tertiary" size="sm" href={url} target="_blank" rel="noreferrer">
                            {openLabel}
                        </Button>
                    </div>
                    {isPreviewing ? (
                        <MediaFrame aspect="portrait" fit="contain">
                            {isPdf ? (
                                <iframe title={say("candCv")} src={url} className={CV_FRAME_CLASS_NAME} />
                            ) : (
                                <Image src={url} alt={say("candCv")} fit="contain" />
                            )}
                        </MediaFrame>
                    ) : null}
                    <Text size="xs" tone="muted">
                        {say("candCvExpires")}
                    </Text>
                </>
            ) : (
                <Text tone="muted">{say(state === "loading" ? "candCvLoading" : "candCvNone")}</Text>
            )}
        </>
    )
}
