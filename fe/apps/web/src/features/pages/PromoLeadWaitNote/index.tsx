import { PromoLeadWait } from "@/components/blocks/PromoLeadWait"

interface PromoLeadWaitNoteProps {
    /** The website lead the note is about. */
    readonly leadId: string
}

/** Server shell for the lead's connected response-delay note. */
export const PromoLeadWaitNote = (props: PromoLeadWaitNoteProps) => <PromoLeadWait leadId={props.leadId} />
