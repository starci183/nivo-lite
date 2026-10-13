import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { HiringSettingsType } from "./hiring-settings.type"
import { HiringJobType } from "./hiring-job.type"
import { HiringCandidateType } from "./hiring-candidate.type"
import { HiringInterviewType } from "./hiring-interview.type"
import { HiringOfferType } from "./hiring-offer.type"
import { HiringOnboardingType } from "./hiring-onboarding.type"
import { HiringMemberType } from "./hiring-member.type"
import { HiringFiguresType } from "./hiring-figures.type"

@ObjectType()
/** The whole hiring workbench a manager sees. */
export class HiringBenchType {
    /** When the view was read. */
    @Field(() => String)
    nowIso!: string

    /** The site origin links are built with. */
    @Field(() => String)
    origin!: string

    /** The hiring settings. */
    @Field(() => HiringSettingsType)
    settings!: HiringSettingsType

    /** Every job, newest first, with its public link. */
    @Field(() => [HiringJobType])
    jobs!: ReadonlyArray<HiringJobType>

    /** The newest candidates. */
    @Field(() => [HiringCandidateType])
    candidates!: ReadonlyArray<HiringCandidateType>

    /** The newest interviews. */
    @Field(() => [HiringInterviewType])
    interviews!: ReadonlyArray<HiringInterviewType>

    /** The newest offers. */
    @Field(() => [HiringOfferType])
    offers!: ReadonlyArray<HiringOfferType>

    /** The onboarding steps. */
    @Field(() => [HiringOnboardingType])
    onboarding!: ReadonlyArray<HiringOnboardingType>

    /** The members and their free windows. */
    @Field(() => [HiringMemberType])
    members!: ReadonlyArray<HiringMemberType>

    /** Decisions waiting for the manager. */
    @Field(() => Int)
    waitingApprovals!: number

    /** The ribbon figures. */
    @Field(() => HiringFiguresType)
    figures!: HiringFiguresType

    /** The caller's user id. */
    @Field(() => ID)
    meUserId!: string
}
