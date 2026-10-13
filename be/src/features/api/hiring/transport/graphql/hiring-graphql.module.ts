import { Module } from "@nestjs/common"
import { HiringApiModule } from "../../hiring.module"
import { ApplyToHiringJobResolver } from "./apply-to-hiring-job.resolver"
import { CancelHiringOfferResolver } from "./cancel-hiring-offer.resolver"
import { CreateHiringCvUploadResolver } from "./create-hiring-cv-upload.resolver"
import { DeleteHiringCandidateResolver } from "./delete-hiring-candidate.resolver"
import { GenerateHiringAdResolver } from "./generate-hiring-ad.resolver"
import { HiringCandidateDetailResolver } from "./hiring-candidate-detail.resolver"
import { HiringWorkbenchResolver } from "./hiring-workbench.resolver"
import { LinkHiringStaffResolver } from "./link-hiring-staff.resolver"
import { MoveHiringCandidateResolver } from "./move-hiring-candidate.resolver"
import { PublicHiringInterviewResolver } from "./public-hiring-interview.resolver"
import { PublicHiringJobResolver } from "./public-hiring-job.resolver"
import { PublicHiringOfferResolver } from "./public-hiring-offer.resolver"
import { RequestHiringInterviewResolver } from "./request-hiring-interview.resolver"
import { RequestHiringOfferResolver } from "./request-hiring-offer.resolver"
import { RescreenHiringCandidateResolver } from "./rescreen-hiring-candidate.resolver"
import { RespondHiringInterviewResolver } from "./respond-hiring-interview.resolver"
import { RespondHiringOfferResolver } from "./respond-hiring-offer.resolver"
import { SaveHiringAvailabilityResolver } from "./save-hiring-availability.resolver"
import { SaveHiringJobResolver } from "./save-hiring-job.resolver"
import { SaveHiringNotesResolver } from "./save-hiring-notes.resolver"
import { SaveHiringSettingsResolver } from "./save-hiring-settings.resolver"
import { SetHiringInterviewStatusResolver } from "./set-hiring-interview-status.resolver"
import { SetHiringJobStatusResolver } from "./set-hiring-job-status.resolver"
import { ToggleHiringOnboardingResolver } from "./toggle-hiring-onboarding.resolver"

@Module({
    imports: [HiringApiModule],
    providers: [
        ApplyToHiringJobResolver,
        CancelHiringOfferResolver,
        CreateHiringCvUploadResolver,
        DeleteHiringCandidateResolver,
        GenerateHiringAdResolver,
        HiringCandidateDetailResolver,
        HiringWorkbenchResolver,
        LinkHiringStaffResolver,
        MoveHiringCandidateResolver,
        PublicHiringInterviewResolver,
        PublicHiringJobResolver,
        PublicHiringOfferResolver,
        RequestHiringInterviewResolver,
        RequestHiringOfferResolver,
        RescreenHiringCandidateResolver,
        RespondHiringInterviewResolver,
        RespondHiringOfferResolver,
        SaveHiringAvailabilityResolver,
        SaveHiringJobResolver,
        SaveHiringNotesResolver,
        SaveHiringSettingsResolver,
        SetHiringInterviewStatusResolver,
        SetHiringJobStatusResolver,
        ToggleHiringOnboardingResolver,
    ],
})
/** The GraphQL transport of the hiring feature. */
export class HiringGraphqlModule {}
