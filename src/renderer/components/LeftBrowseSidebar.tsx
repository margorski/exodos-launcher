import * as React from "react";
import { GamePlaylist } from "@shared/interfaces";
import { memoizeOne } from "@shared/memoize";
import { WithPreferencesProps } from "../containers/withPreferences";
import { InputElement } from "./InputField";
import { OpenIcon } from "./OpenIcon";
import { PlaylistItemContent } from "./PlaylistContent";
import { PlaylistItem } from "./PlaylistItem";
import { englishTranslation } from "@renderer/lang/en";

type OwnProps = {
    playlists: GamePlaylist[];
    /** ID of the playlist that is selected (empty string if none). */
    selectedPlaylistID: string;
    currentPlaylist?: GamePlaylist;
    currentPlaylistFilename?: string;
    playlistIconCache: Record<string, string>;
    onItemClick: (playlistId: string, selected: boolean) => void;
    onSetIcon: () => void;
    onShowAllClick?: () => void;
    onTitleChange: (event: React.ChangeEvent<InputElement>) => void;
    onAuthorChange: (event: React.ChangeEvent<InputElement>) => void;
    onDescriptionChange: (event: React.ChangeEvent<InputElement>) => void;
    onFilenameChange: (event: React.ChangeEvent<InputElement>) => void;
};

export type LeftBrowseSidebarProps = OwnProps & WithPreferencesProps;

export interface LeftBrowseSidebar {
}

/** Sidebar on the left side of BrowsePage. */
export class LeftBrowseSidebar extends React.Component<LeftBrowseSidebarProps> {
    render() {
        const strings = englishTranslation.browse;
        const {
            currentPlaylist,
            onShowAllClick,
            playlistIconCache,
            playlists,
            selectedPlaylistID,
        } = this.props;
        return (
            <div className="browse-left-sidebar">
                <div className="playlist-list">
                    {/* All games */}
                    <div
                        className="playlist-list-fake-item"
                        onClick={onShowAllClick}
                    >
                        <div className="playlist-list-fake-item__inner">
                            <OpenIcon icon="eye" />
                        </div>
                        <div className="playlist-list-fake-item__inner">
                            <p className="playlist-list-fake-item__inner__title">
                                {strings.allGames}
                            </p>
                        </div>
                    </div>
                    {/* List all playlists */}
                    {this.renderPlaylistsMemo(
                        playlists,
                        playlistIconCache,
                        currentPlaylist,
                        selectedPlaylistID
                    )}
                </div>
            </div>
        );
    }

    renderPlaylistsMemo = memoizeOne(
        (
            playlists: GamePlaylist[],
            playlistIconCache: Record<string, string>,
            currentPlaylist: GamePlaylist | undefined,
            selectedPlaylistID: string
        ) => {
            const renderItem = (
                playlist: GamePlaylist,
                isNew: boolean
            ): void => {
                const isSelected =
                    isNew || playlist.filename === selectedPlaylistID;
                const p =
                    isSelected && currentPlaylist ? currentPlaylist : playlist;
                const key = isNew ? "?new" : playlist.filename;
                elements.push(
                    <PlaylistItem
                        key={key}
                        playlist={p}
                        iconFilename={
                            isSelected
                                ? this.props.currentPlaylistFilename
                                : undefined
                        }
                        selected={isSelected}
                        playlistIconCache={playlistIconCache}
                        onHeadClick={this.props.onItemClick}
                        onSetIcon={this.props.onSetIcon}
                        onTitleChange={this.props.onTitleChange}
                        onAuthorChange={this.props.onAuthorChange}
                    />
                );
                if (isSelected) {
                    elements.push(
                        <PlaylistItemContent
                            key={key + "?content"} // Includes "?" because it's an invalid filename character
                            playlist={p}
                            onDescriptionChange={this.props.onDescriptionChange}
                            OnFilenameChange={this.props.onFilenameChange}
                        />
                    );
                }
            };

            const elements: JSX.Element[] = [];
            for (let i = 0; i < playlists.length; i++) {
                renderItem(playlists[i], false);
            }
            return elements;
        }
    );
}
