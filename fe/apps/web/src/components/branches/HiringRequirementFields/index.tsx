import { Input, NumberField, Textarea } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import type { HiringJobFieldCommands, HiringJobValues } from "@/hooks/hiringJobs"
import { GRID_CLASS_NAME } from "./classNames"

/** The words, values and changes of the requirement fields of a job. */
interface HiringRequirementFieldsProps extends HiringJobFieldCommands {
    readonly say: HiringSay
    readonly values: HiringJobValues
}

/** What a job screens candidates on: skills, hours, must-haves, nice-to-haves, years and the experience note. */
export const HiringRequirementFields = (props: HiringRequirementFieldsProps) => {
    const { say, values, onText, onNumber } = props
    return (
        <div className={GRID_CLASS_NAME}>
            <Textarea
                variant="secondary"
                label={say("jobSkills")}
                description={say("jobSkillsHint")}
                rows={3}
                value={values.skills}
                onValueChange={(skills) => onText("skills", skills)}
            />
            <Textarea
                variant="secondary"
                label={say("jobAvailability")}
                description={say("jobAvailabilityHint")}
                rows={3}
                value={values.availability}
                onValueChange={(availability) => onText("availability", availability)}
            />
            <Textarea
                variant="secondary"
                label={say("jobMustHave")}
                description={say("jobMustHaveHint")}
                rows={3}
                value={values.mustHave}
                onValueChange={(mustHave) => onText("mustHave", mustHave)}
            />
            <Textarea
                variant="secondary"
                label={say("jobNiceToHave")}
                description={say("jobNiceToHaveHint")}
                rows={3}
                value={values.niceToHave}
                onValueChange={(niceToHave) => onText("niceToHave", niceToHave)}
            />
            <NumberField
                variant="secondary"
                label={say("jobYears")}
                minValue={0}
                maxValue={50}
                step={1}
                {...(values.years === null ? {} : { value: values.years })}
                onValueChange={(value) => onNumber("years", Number.isFinite(value) ? value : null)}
            />
            <Input
                id="job-exp-note"
                name="experience_note"
                label={say("jobExperienceNote")}
                variant="secondary"
                value={values.experienceNote}
                onValueChange={(note) => onText("experienceNote", note)}
            />
        </div>
    )
}
