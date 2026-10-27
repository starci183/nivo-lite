import { Input, NumberField, Textarea } from "@starci/grammar/common"
import type { HiringJobFieldCommands, HiringJobValues, HiringSay } from "@/modules/types"
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
                label={say("jobSkills")}
                description={say("jobSkillsHint")}
                rows={3}
                value={values.skills}
                onValueChange={(skills) => onText("skills", skills)}
            />
            <Textarea
                label={say("jobAvailability")}
                description={say("jobAvailabilityHint")}
                rows={3}
                value={values.availability}
                onValueChange={(availability) => onText("availability", availability)}
            />
            <Textarea
                label={say("jobMustHave")}
                description={say("jobMustHaveHint")}
                rows={3}
                value={values.mustHave}
                onValueChange={(mustHave) => onText("mustHave", mustHave)}
            />
            <Textarea
                label={say("jobNiceToHave")}
                description={say("jobNiceToHaveHint")}
                rows={3}
                value={values.niceToHave}
                onValueChange={(niceToHave) => onText("niceToHave", niceToHave)}
            />
            <NumberField
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
                value={values.experienceNote}
                onValueChange={(note) => onText("experienceNote", note)}
            />
        </div>
    )
}
