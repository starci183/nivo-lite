import type { WeeklyPost, WeeklySuggestion } from "@modules/domain/content-weekly-reports"
import type { Locale } from "@modules/platform/i18n"

/** One named brand color, `#rrggbb` lower case. */
export interface BrandColor {
    /** The name the guideline gives it ("Gold"). */
    readonly name: string
    /** The hex value. */
    readonly hex: string
}

/** The brand kit read from a guideline: colors, fonts, tone of voice and the imagery it asks for. */
export interface GuidelineKit {
    /** The brand or business name as the guideline writes it. */
    readonly brandName: string
    /** The colors, primary first (at most six). */
    readonly colors: ReadonlyArray<BrandColor>
    /** The font families, heading first (at most four). */
    readonly fonts: ReadonlyArray<string>
    /** The tone of voice, one or two sentences. */
    readonly tone: string
    /** How the brand addresses itself and the customer ("xung HAKUEN"). */
    readonly address: string
    /** The kind of imagery the guideline asks for (at most five short phrases). */
    readonly imagery: ReadonlyArray<string>
    /** Words or claims to avoid. */
    readonly avoid: ReadonlyArray<string>
}

/** Where a brand proposal stands. */
export type BrandProposalStatus = "proposed" | "applied" | "rejected"

/** A brand kit read from an attached file, waiting for the owner's confirmation. */
export interface BrandProposal {
    /** The proposal. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent instance whose setup chat received the file. */
    readonly installationId: string | null
    /** The setup draft the file was attached to. */
    readonly setupSessionId: string | null
    /** The attached file name. */
    readonly fileName: string
    /** The attached file size, bytes. */
    readonly fileSize: number
    /** The kit. */
    readonly kit: GuidelineKit
    /** Where it stands. */
    readonly status: BrandProposalStatus
    /** Who decided it. */
    readonly decidedBy: string | null
    /** When it was read, ISO 8601. */
    readonly createdAt: string
}

/** A file attached in the setup chat: its name and bytes. */
export interface AttachedFile {
    /** The file name, with its extension. */
    readonly name: string
    /** The bytes as base64. */
    readonly contentBase64: string
}

/** What reading a brand guideline asks for. */
export interface ProposeBrandRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent instance whose setup chat received the file; empty for none. */
    readonly installationId: string
    /** The setup draft the file was attached to; empty for none. */
    readonly setupSessionId: string
    /** The file. */
    readonly file: AttachedFile
    /** The language of the reply. */
    readonly locale: Locale
}

/** The owner's decision on a brand proposal, with the edits made on the card. */
export interface BrandDecision {
    /** Confirm or reject. */
    readonly decision: "confirm" | "reject"
    /** The kit as edited; absent or null keeps the proposal. */
    readonly kit?: GuidelineKit | null
}

/** One beat of the short video script. */
export interface ScriptBeat {
    /** The time range, `00-05s`. */
    readonly at: string
    /** What the viewer sees and hears. */
    readonly line: string
}

/** One brand image to compose: the headline and the line under it. */
export interface ImageCopy {
    /** The big headline (a few words). */
    readonly headline: string
    /** The small line (offer, call to action). */
    readonly subline: string
}

/** The post draft the model wrote for one owner request. */
export interface MarketingDraft {
    /** The post title. */
    readonly title: string
    /** The caption, without the hashtags. */
    readonly caption: string
    /** The hashtags, each starting with `#`. */
    readonly hashtags: ReadonlyArray<string>
    /** The copy of the two brand images. */
    readonly images: ReadonlyArray<ImageCopy>
    /** The 15 second video script, three beats. */
    readonly script: ReadonlyArray<ScriptBeat>
}

/** The colors, logo and fonts one composed image uses. */
export interface ImageStyle {
    /** The background color. */
    readonly background: string
    /** The text color. */
    readonly ink: string
    /** The accent (bar and subline). */
    readonly accent: string
    /** True to put the photo on the left, text on the right. */
    readonly photoLeft: boolean
}

/** Everything one ffmpeg run of a brand image needs; paths are relative to the work directory. */
export interface ImageJob {
    /** The library photo, or null for a plain brand canvas. */
    readonly photo: string | null
    /** The logo, or null. */
    readonly logo: string | null
    /** The file holding the headline text. */
    readonly headlineFile: string
    /** The file holding the subline text. */
    readonly sublineFile: string
    /** The bold font file. */
    readonly boldFont: string
    /** The regular font file. */
    readonly regularFont: string
    /** The colors. */
    readonly style: ImageStyle
    /** The PNG to write. */
    readonly output: string
}

/** One day of one channel's engagement. */
export interface EngagementDay {
    /** The channel. */
    readonly channel: string
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** Unique people reached. */
    readonly reach: number
    /** Engagements. */
    readonly engagements: number
    /** New messages. */
    readonly messages: number
}

/** One metric of the weekly report with the change against the week before. */
export interface ReportMetric {
    /** This week. */
    readonly value: number
    /** The week before. */
    readonly previous: number
    /** Change in percent, rounded; null when the week before was zero. */
    readonly changePct: number | null
}

/** The weekly marketing report the card and the "Performance" tab show. */
export interface MarketingWeeklyReport {
    /** The first day of the week, `YYYY-MM-DD` (Monday). */
    readonly weekStart: string
    /** The last day of the week, `YYYY-MM-DD` (Sunday). */
    readonly weekEnd: string
    /** Reach. */
    readonly reach: ReportMetric
    /** Engagements. */
    readonly engagements: ReportMetric
    /** New messages. */
    readonly messages: ReportMetric
    /** Engagements per day and channel, Monday first. */
    readonly days: ReadonlyArray<ReportDay>
    /** The channels that reported. */
    readonly channels: ReadonlyArray<string>
    /** The most engaging posts published in the week, most engagements first (at most four). */
    readonly posts: ReadonlyArray<WeeklyPost>
    /** How many posts the channels published in the week. */
    readonly postCount: number
    /** What the model reads from the week and advises next; null for a week without engagement or when the model failed. */
    readonly suggestion: WeeklySuggestion | null
}

/** The words of the advice the model answered, before its sources are attached. */
export interface SuggestionText {
    /** The headline, at most 120 characters. */
    readonly title: string
    /** The reasoning and the next step, at most 600 characters. */
    readonly body: string
}

/** One post of the Page as the report reads it, before it is ranked. */
export interface PublishedPost {
    /** The provider post id. */
    readonly id: string
    /** The channel. */
    readonly channel: string
    /** The post text. */
    readonly message: string
    /** When it was published, ISO 8601. */
    readonly publishedAt: string
    /** The engagements the channel counted. */
    readonly engagements: number
    /** The public link, or null. */
    readonly href: string | null
}

/** One day of the report chart. */
export interface ReportDay {
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** Engagements by channel. */
    readonly byChannel: Readonly<Record<string, number>>
    /** The same engagements as a list, channel order of the report. */
    readonly channels: ReadonlyArray<ChannelValue>
}

/** The engagements of one channel on one day. */
export interface ChannelValue {
    /** The channel. */
    readonly channel: string
    /** The engagements. */
    readonly value: number
}

/** The confirmed brand of a workspace as drafting reads it. */
export interface WorkspaceBrand {
    /** The kit, or null before one was confirmed. */
    readonly kit: GuidelineKit | null
    /** The logo path in the media bucket, or null. */
    readonly logoPath: string | null
}

/** The day and channel of a week's best engagement. */
export interface BestDay {
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** The channel. */
    readonly channel: string
}

/** The neighbouring week starts of a week. */
export interface WeekBounds {
    /** The Monday of the week before, `YYYY-MM-DD`. */
    readonly previousStart: string
    /** The Monday of the week after, `YYYY-MM-DD`. */
    readonly nextStart: string
}

/** One "@AI Marketing ..." request to draft. */
export interface DraftRequest {
    /** The owner's words. */
    readonly request: string
    /** The draft_post work item it became, or null. */
    readonly workItemId: string | null
    /** The publish moment the request asked for, ISO 8601, or null. */
    readonly scheduledAt: string | null
}

/** What drafting produced: the content item and the publish_post decision, or why there is none (a line was posted). */
export interface DraftOutcome {
    /** True when the draft and its decision exist. */
    readonly ok: boolean
    /** Why there is no draft; empty on success. */
    readonly reason: string
    /** The content item, or null. */
    readonly contentItemId: string | null
    /** The publish_post work item, or null. */
    readonly approvalWorkItemId: string | null
}

/** What scheduling one approved post needs. */
export interface ScheduleRequest {
    /** The approved content item. */
    readonly contentItemId: string
    /** The publish_post work item a person approved. */
    readonly workItemId: string
}

/** One AI Marketing tick: every workspace, or the one an operator names. */
export interface MarketingTickRequest {
    /** Run the weekly report of this workspace only. */
    readonly workspaceId?: string
}

/** What one AI Marketing tick posted. */
export interface MarketingTickDone {
    /** The Zalo OA articles published at their moment. */
    readonly published: number
    /** The weekly report cards posted. */
    readonly reports: number
}
