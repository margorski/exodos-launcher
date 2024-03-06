import * as React from "react";
import { GamePlaylist } from "@shared/interfaces";
import { InputElement, InputField } from "./InputField";
import { englishTranslation } from "@renderer/lang/en";

export type PlaylistItemContentProps = {
	playlist: GamePlaylist;

	onDescriptionChange: (event: React.ChangeEvent<InputElement>) => void;
	OnFilenameChange: (event: React.ChangeEvent<InputElement>) => void;
};

export function PlaylistItemContent(props: PlaylistItemContentProps) {
	const strings = englishTranslation.playlist;
	let className = "playlist-list-content";

	return (
		<div className={className}>
			<div className="playlist-list-content__inner">
				<InputField
					text={props.playlist.description}
					placeholder={strings.noDescription}
					className="playlist-list-content__description"
					onChange={props.onDescriptionChange}
					multiline={true}
				/>
			</div>
		</div>
	);
}
