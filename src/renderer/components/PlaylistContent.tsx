import * as React from "react";
import { GamePlaylist } from "@shared/interfaces";
import { LangContext } from "../util/lang";
import { InputElement, InputField } from "./InputField";

export type PlaylistItemContentProps = {
    playlist: GamePlaylist;

    onDescriptionChange: (event: React.ChangeEvent<InputElement>) => void;
    OnFilenameChange: (event: React.ChangeEvent<InputElement>) => void;
};

export function PlaylistItemContent(props: PlaylistItemContentProps) {
    const strings = React.useContext(LangContext).playlist;
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
