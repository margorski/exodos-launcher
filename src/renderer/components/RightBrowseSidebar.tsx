import { MenuItemConstructorOptions } from "electron";
import { BrowserWindow, shell } from "@electron/remote";
import * as React from "react";
import { BackIn, LaunchAddAppData, LaunchGameData } from "@shared/back/types";
import { LOGOS, SCREENSHOTS } from "@shared/constants";
import { wrapSearchTerm } from "@shared/game/GameFilter";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { GamePlaylistEntry, PickType } from "@shared/interfaces";
import { WithPreferencesProps } from "../containers/withPreferences";
import { WithSearchProps } from "../containers/withSearch";
import {
    getGameImagePath,
    getGameScreenshotsUrls,
    resourceExists,
} from "../Util";
import { DropdownInputField } from "./DropdownInputField";
import { ImagePreview } from "./ImagePreview";
import { InputField } from "./InputField";
import { RightBrowseSidebarAddApp } from "./RightBrowseSidebarAddApp";
import { getFileServerURL } from "@shared/Util";
import { openContextMenu } from "@main/Util";
import { englishTranslation } from "@renderer/lang/en";

type OwnProps = {
    /** Currently selected game (if any) */
    currentGame?: IGameInfo;
    /** Additional Applications of the currently selected game (if any) */
    currentAddApps?: IAdditionalApplicationInfo[];
    /** Notes of the selected game in the selected playlist (if any) */
    currentPlaylistNotes?: string;
    /* Current Library */
    currentLibrary: string;
    /** Currently selected game entry (if any) */
    gamePlaylistEntry?: GamePlaylistEntry;
    /** Called when a playlist is deselected (searching game fields) */
    onDeselectPlaylist: () => void;
    /** If the selected game is installed */
    isInstalled: boolean;
    /** For other things than games like magazines different buttons are displayed */
    isGame: boolean;
};

export type RightBrowseSidebarProps = OwnProps &
    WithPreferencesProps &
    WithSearchProps;

type RightBrowseSidebarState = {
    /** If a preview of the current game's screenshot should be shown. */
    screenshotPreviewUrl: string;
    screenshots: string[];
};

export interface RightBrowseSidebar {}

/** Sidebar on the right side of BrowsePage. */
export class RightBrowseSidebar extends React.Component<
    RightBrowseSidebarProps,
    RightBrowseSidebarState
> {
    // Bound "on change" callbacks for game fields
    onTitleChange = this.wrapOnTextChange((game, text) => {
        game.convertedTitle = text;
    });
    onAlternateTitlesChange = this.wrapOnTextChange((game, text) => {
        game.alternateTitles = text;
    });
    onDeveloperChange = this.wrapOnTextChange((game, text) => {
        game.developer = text;
    });
    onTagsChange = this.wrapOnTextChange((game, text) => {
        game.tags = text;
    });
    onSeriesChange = this.wrapOnTextChange((game, text) => {
        game.series = text;
    });
    onSourceChange = this.wrapOnTextChange((game, text) => {
        game.source = text;
    });
    onPublisherChange = this.wrapOnTextChange((game, text) => {
        game.publisher = text;
    });
    onPlatformChange = this.wrapOnTextChange((game, text) => {
        game.platform = text;
    });
    onPlayModeChange = this.wrapOnTextChange((game, text) => {
        game.playMode = text;
    });
    onStatusChange = this.wrapOnTextChange((game, text) => {
        game.status = text;
    });
    onVersionChange = this.wrapOnTextChange((game, text) => {
        game.version = text;
    });
    onReleaseDateChange = this.wrapOnTextChange((game, text) => {
        game.releaseDate = text;
    });
    onLanguageChange = this.wrapOnTextChange((game, text) => {
        game.language = text;
    });
    onLaunchCommandChange = this.wrapOnTextChange((game, text) => {
        game.launchCommand = text;
    });
    onApplicationPathChange = this.wrapOnTextChange((game, text) => {
        game.applicationPath = text;
    });
    onNotesChange = this.wrapOnTextChange((game, text) => {
        game.notes = text;
    });
    onOriginalDescriptionChange = this.wrapOnTextChange((game, text) => {
        game.originalDescription = text;
    });
    // Bound "on click" callbacks for game fields
    onDeveloperClick = this.wrapOnTextClick("developer");
    onTagsClick = this.wrapOnTextClick("tags");
    onSeriesClick = this.wrapOnTextClick("series");
    onSourceClick = this.wrapOnTextClick("source");
    onPublisherClick = this.wrapOnTextClick("publisher");
    onPlatformClick = this.wrapOnTextClick("platform");
    onPlayModeClick = this.wrapOnTextClick("playMode");
    onStatusClick = this.wrapOnTextClick("status");
    onVersionClick = this.wrapOnTextClick("version");
    onLanguageClick = this.wrapOnTextClick("language");

    launchCommandRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props: RightBrowseSidebarProps) {
        super(props);
        this.state = {
            screenshotPreviewUrl: "",
            screenshots: [],
        };
    }

    async getExistingScreenshotsList(
        game: IGameInfo | null
    ): Promise<string[]> {
        if (!game) return [];

        var allScreenshots = getGameScreenshotsUrls(game.platform, game.title);
        var existingScreenshots = [];

        for (var s of allScreenshots) {
            if (await resourceExists(s)) existingScreenshots.push(s);
        }
        return existingScreenshots;
    }

    componentDidUpdate(prevProps: RightBrowseSidebarProps): void {
        if (this.props.currentGame !== prevProps.currentGame) {
            if (this.props.currentGame) {
                this.getExistingScreenshotsList(this.props.currentGame).then(
                    (screenshots) => {
                        this.setState({
                            screenshots: screenshots,
                        });
                    }
                );
            } else {
                this.setState({
                    screenshots: [],
                });
            }
        }
    }

    render() {
        const strings = englishTranslation.browse;
        const game: IGameInfo | undefined = this.props.currentGame;

        if (game) {
            const {
                currentAddApps,
                gamePlaylistEntry,
                currentPlaylistNotes,
                isInstalled,
            } = this.props;
            // TODO somehow parametrize this to do not display unnecessary buttons for magazines
            const playButtonLabel = this.props.isGame
                ? isInstalled
                    ? strings.play
                    : strings.install
                : strings.open;
            return (
                <div
                    className={
                        "browse-right-sidebar browse-right-sidebar--edit-disabled"
                    }
                >
                    {/* -- Title & Developer(s) -- */}
                    <div className="browse-right-sidebar__section">
                        <div className="browse-right-sidebar__row">
                            <div className="browse-right-sidebar__title-row">
                                <div className="browse-right-sidebar__title-row__title">
                                    <InputField
                                        text={game.convertedTitle}
                                        placeholder={strings.noTitle}
                                        onChange={this.onTitleChange}
                                    />
                                </div>
                                <div className="browse-right-sidebar__title-row__buttons">
                                    <input
                                        type="button"
                                        className="simple-button"
                                        value={playButtonLabel}
                                        onClick={() =>
                                            window.External.back.send<LaunchGameData>(
                                                BackIn.LAUNCH_GAME,
                                                { id: game.id }
                                            )
                                        }
                                    />
                                    {this.props.isGame ? (
                                        <input
                                            type="button"
                                            className="simple-button"
                                            disabled={!isInstalled}
                                            value={strings.setup}
                                            onClick={() =>
                                                window.External.back.send<LaunchGameData>(
                                                    BackIn.LAUNCH_GAME_SETUP,
                                                    { id: game.id }
                                                )
                                            }
                                        />
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* -- Most Fields -- */}
                    {/* -- Screenshot -- */}
                    <div className="browse-right-sidebar__section">
                        {this.state.screenshots.map((s, idx) => (
                            <div
                                className="browse-right-sidebar__row"
                                key={`screenshot-row-div-${idx}`}
                            >
                                <div
                                    className="browse-right-sidebar__row__screenshot"
                                    key={`screenshot-div-${idx}`}
                                    onContextMenu={this.onScreenshotContextMenu}
                                >
                                    <img
                                        className="browse-right-sidebar__row__screenshot-image"
                                        alt="" // Hide the broken link image if source is not found
                                        src={s}
                                        key={`screenshot-img-${idx}`}
                                        onClick={() =>
                                            this.onScreenshotClick(s)
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* -- Playlist Game Entry Notes -- */}
                    {gamePlaylistEntry ? (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row">
                                <p>{strings.playlistNotes}: </p>
                                <InputField
                                    text={currentPlaylistNotes || ""}
                                    placeholder={strings.noPlaylistNotes}
                                    multiline={true}
                                />
                            </div>
                        </div>
                    ) : undefined}
                    {/* -- Additional Applications -- */}
                    {currentAddApps && currentAddApps.length > 0 && (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row browse-right-sidebar__row--additional-applications-header">
                                <p>{strings.additionalApplications}:</p>
                            </div>
                            {currentAddApps &&
                                currentAddApps.map((addApp) => (
                                    <RightBrowseSidebarAddApp
                                        key={addApp.id}
                                        addApp={addApp}
                                        onLaunch={this.onAddAppLaunch}
                                    />
                                ))}
                        </div>
                    )}

                    {/* -- Screenshot Preview -- */}
                    {this.state.screenshotPreviewUrl ? (
                        <ImagePreview
                            src={this.state.screenshotPreviewUrl}
                            onCancel={this.onScreenshotPreviewClick}
                        />
                    ) : undefined}
                </div>
            );
        } else {
            return (
                <div className="browse-right-sidebar-empty">
                    <h1>{strings.noGameSelected}</h1>
                    <p>{strings.clickToSelectGame}</p>
                </div>
            );
        }
    }

    onScreenshotContextMenu = (event: React.MouseEvent) => {
        const { currentGame } = this.props;
        const template: MenuItemConstructorOptions[] = [];
        if (currentGame) {
            template.push({
                label: englishTranslation.menu.viewThumbnailInFolder,
                click: () => {
                    shell.showItemInFolder(
                        getGameImagePath(LOGOS, currentGame.id).replace(
                            /\//g,
                            "\\"
                        )
                    );
                },
                enabled: true,
            });
            template.push({
                label: englishTranslation.menu.viewScreenshotInFolder,
                click: () => {
                    shell.showItemInFolder(
                        getGameImagePath(SCREENSHOTS, currentGame.id).replace(
                            /\//g,
                            "\\"
                        )
                    );
                },
                enabled: true,
            });
        }
        if (template.length > 0) {
            event.preventDefault();
            openContextMenu(template);
        }
    };

    onAddAppLaunch(addApp: IAdditionalApplicationInfo): void {
        const isHtml =
            addApp.applicationPath.toLocaleLowerCase().endsWith(".html") ||
            addApp.applicationPath.toLocaleLowerCase().endsWith(".htm");
        if (isHtml) {
            let url = `${getFileServerURL()}/${addApp.applicationPath.replace(
                "\\",
                "/"
            )}`;
            console.log(
                `Got HTML additional application, running in new browser window. ${url}`
            );
            let win = new BrowserWindow({
                show: false,
                title: addApp.name,
                resizable: false,
                width: 1100,
                height: 962,
            });
            win.setMenuBarVisibility(false);
            win.loadURL(url);
            win.once("ready-to-show", () => {
                win.show();
                win.focus();
            });
        } else {
            window.External.back.send<any, LaunchAddAppData>(
                BackIn.LAUNCH_ADDAPP,
                {
                    id: addApp.id,
                }
            );
        }
    }

    onAddAppDelete = (addAppId: string): void => {
        const addApps = this.props.currentAddApps;
        if (!addApps) {
            throw new Error("editAddApps is missing.");
        }
        const index = addApps.findIndex((addApp) => addApp.id === addAppId);
        if (index === -1) {
            throw new Error(
                "Cant remove additional application because it was not found."
            );
        }
        addApps.splice(index, 1);
        this.forceUpdate();
    };

    onScreenshotClick = (screenshotUrl: string): void => {
        this.setState({ screenshotPreviewUrl: screenshotUrl });
    };

    onScreenshotPreviewClick = (): void => {
        this.setState({ screenshotPreviewUrl: "" });
    };

    /** Create a callback for when a game field is clicked. */
    wrapOnTextClick<T extends PickType<IGameInfo, string>>(
        field: T
    ): () => void {
        return () => {
            const { currentGame } = this.props;
            if (currentGame) {
                this.props.onDeselectPlaylist();
                const value = currentGame[field];
                const search = value
                    ? `${field}:${wrapSearchTerm(value)}`
                    : `missing:${field}`;
                this.props.onSearch(search);
            }
        };
    }

    /** Create a wrapper for a EditableTextWrap's onChange callback (this is to reduce redundancy). */
    wrapOnTextChange(
        func: (game: IGameInfo, text: string) => void
    ): (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void {
        return (event) => {
            const game = this.props.currentGame;
            if (game) {
                func(game, event.currentTarget.value);
                this.forceUpdate();
            }
        };
    }
}
