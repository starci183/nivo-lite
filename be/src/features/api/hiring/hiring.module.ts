import { Module } from "@nestjs/common"
import { ApplyToHiringJobHandler } from "./application/apply-to-hiring-job.handler"
import { CancelHiringOfferHandler } from "./application/cancel-hiring-offer.handler"
import { CreateHiringCvUploadHandler } from "./application/create-hiring-cv-upload.handler"
import { DeleteHiringCandidateHandler } from "./application/delete-hiring-candidate.handler"
import { GenerateHiringAdHandler } from "./application/generate-hiring-ad.handler"
import { HiringCandidateDetailHandler } from "./application/hiring-candidate-detail.handler"
import { HiringWorkbenchHandler } from "./application/hiring-workbench.handler"
import { LinkHiringStaffHandler } from "./application/link-hiring-staff.handler"
import { MoveHiringCandidateHandler } from "./application/move-hiring-candidate.handler"
import { PublicHiringInterviewHandler } from "./application/public-hiring-interview.handler"
import { PublicHiringJobHandler } from "./application/public-hiring-job.handler"
import { PublicHiringOfferHandler } from "./application/public-hiring-offer.handler"
import { RequestHiringInterviewHandler } from "./application/request-hiring-interview.handler"
import { RequestHiringOfferHandler } from "./application/request-hiring-offer.handler"
import { RescreenHiringCandidateHandler } from "./application/rescreen-hiring-candidate.handler"
import { RespondHiringInterviewHandler } from "./application/respond-hiring-interview.handler"
import { RespondHiringOfferHandler } from "./application/respond-hiring-offer.handler"
import { SaveHiringAvailabilityHandler } from "./application/save-hiring-availability.handler"
import { SaveHiringJobHandler } from "./application/save-hiring-job.handler"
import { SaveHiringNotesHandler } from "./application/save-hiring-notes.handler"
import { SaveHiringSettingsHandler } from "./application/save-hiring-settings.handler"
import { SetHiringInterviewStatusHandler } from "./application/set-hiring-interview-status.handler"
import { SetHiringJobStatusHandler } from "./application/set-hiring-job-status.handler"
import { ToggleHiringOnboardingHandler } from "./application/toggle-hiring-onboarding.handler"

@Module({
    providers: [
        ApplyToHiringJobHandler,
        CancelHiringOfferHandler,
        CreateHiringCvUploadHandler,
        DeleteHiringCandidateHandler,
        GenerateHiringAdHandler,
        HiringCandidateDetailHandler,
        HiringWorkbenchHandler,
        LinkHiringStaffHandler,
        MoveHiringCandidateHandler,
        PublicHiringInterviewHandler,
        PublicHiringJobHandler,
        PublicHiringOfferHandler,
        RequestHiringInterviewHandler,
        RequestHiringOfferHandler,
        RescreenHiringCandidateHandler,
        RespondHiringInterviewHandler,
        RespondHiringOfferHandler,
        SaveHiringAvailabilityHandler,
        SaveHiringJobHandler,
        SaveHiringNotesHandler,
        SaveHiringSettingsHandler,
        SetHiringInterviewStatusHandler,
        SetHiringJobStatusHandler,
        ToggleHiringOnboardingHandler,
    ],
})
/** The hiring feature: the handlers of its application. */
export class HiringApiModule {}
