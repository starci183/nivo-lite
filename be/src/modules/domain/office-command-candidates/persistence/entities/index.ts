import { OfficeCommandCandidateEntity } from "./office-command-candidate.entity"

export { OfficeCommandCandidateEntity }

/** Every entity the office-command-candidates capability owns, collected by the database connection. */
export const officeCommandCandidatesEntities = [OfficeCommandCandidateEntity] as const
