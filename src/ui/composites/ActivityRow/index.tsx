import { Text, TextAction } from "@starci/grammar/common";
import { Avatar } from "../../leaves/Avatar";
import { ReactionPicker, type ReactionPickerChoiceData } from "../../leaves/ReactionPicker";

import { BODY_CLASS_NAME, ROOT_CLASS_NAME, SENTENCE_CLASS_NAME } from "./classNames";
import type { ReactionType } from "../../leaves/ReactionPicker/reaction-type";

/** Public ActivityRowData declaration. */
export type ActivityRowData = {readonly id: string;readonly actor?: string;readonly avatar?: string;readonly action?: string;readonly target?: string;readonly time?: string;readonly reactionLabel?: string;readonly reactionCount?: number;readonly selectedReaction?: ReactionType | null;readonly reactionChoices?: ReadonlyArray<ReactionPickerChoiceData>;readonly isMine?: boolean;readonly isReacting?: boolean;};
/** Public ActivityRowActions declaration. */
export type ActivityRowActions = {readonly openActor?: () => void;readonly openTarget?: () => void;readonly react?: (type: ReactionType | null) => void;};
/** Public ActivityRowProps declaration. */
export type ActivityRowProps = {readonly props: ActivityRowData;readonly on?: ActivityRowActions;readonly isLoading?: boolean;};

/** Public ActivityRow declaration. */
export const ActivityRow = (props: ActivityRowProps) => ActivityRowView(props);
const ActivityRowView = ({ props, on, isLoading = false }: ActivityRowProps) =>
<div className={ROOT_CLASS_NAME}>
        <Avatar props={{ name: props.actor, src: props.avatar, size: "sm" }} isLoading={isLoading} />
        <div className={BODY_CLASS_NAME}>
            <div className={SENTENCE_CLASS_NAME}>
                <TextAction size="sm" isSkeleton={isLoading} onPress={on?.openActor}>{props.actor ?? ""}</TextAction>
                <Text size="sm" isSkeleton={isLoading}>{props.action}</Text>
                {props.target === undefined ? null : <TextAction size="sm" onPress={on?.openTarget}>{props.target}</TextAction>}
            </div>
            {props.reactionLabel === undefined || props.reactionChoices === undefined ? null :
    <ReactionPicker props={{ label: props.reactionLabel, count: props.reactionCount ?? 0, selected: props.selectedReaction, choices: props.reactionChoices, isPending: props.isReacting }} on={props.isMine === true ? undefined : { select: on?.react }} />
    }
        </div>
        <Text size="xs" tone="muted" isSkeleton={isLoading}>{props.time}</Text>
    </div>;
