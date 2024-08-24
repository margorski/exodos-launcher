import { BrowserWindow, shell } from "@electron/remote";
import { openContextMenu } from "@main/Util";
import { englishTranslation } from "@renderer/lang/en";
import { getFileServerURL } from "@shared/Util";
import { LOGOS, SCREENSHOTS } from "@shared/constants";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { GamePlaylistEntry } from "@shared/interfaces";
import { MenuItemConstructorOptions } from "electron";
import * as React from "react";
import { getGameImagePath } from "../Util";
import { WithPreferencesProps } from "../containers/withPreferences";
import { DropdownInputField } from "./DropdownInputField";
import { FormattedGameMedia, GameImageCarousel } from "./GameImageCarousel";
import { MediaPreview } from "./ImagePreview";
import { InputField } from "./InputField";
import { RightBrowseSidebarAddApp } from "./RightBrowseSidebarAddApp";

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
    /** Launch game */
    onGameLaunch: (gameId: string) => void;
    /** Launch game setup */
    onGameLaunchSetup: (gameId: string) => void;
    /** Launch add app */
    onAddAppLaunch: (addAppId: string) => void;
};

export type RightBrowseSidebarProps = OwnProps & WithPreferencesProps;

type RightBrowseSidebarState = {
    /** If a preview of the current game's selected media. */
    previewMedia?: FormattedGameMedia;
};

export interface RightBrowseSidebar {}

/** Sidebar on the right side of BrowsePage. */
export class RightBrowseSidebar extends React.Component<
    RightBrowseSidebarProps,
    RightBrowseSidebarState
> {
    launchCommandRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props: RightBrowseSidebarProps) {
        super(props);
        this.state = {};
    }

    render() {
        const strings = englishTranslation.browse;
        const game: IGameInfo | undefined = this.props.currentGame;
        // HACK: This is a hacky solution to determine if the selected item is a game or a magazine
        if (game) {
            const {
                currentGame,
                currentAddApps,
                gamePlaylistEntry,
                currentPlaylistNotes,
            } = this.props;

            const isGame = !!game?.configurationPath;
            const playButtonLabel = isGame
                ? currentGame?.installed
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
                                    />
                                </div>
                                <div className="browse-right-sidebar__title-row__buttons">
                                    <input
                                        type="button"
                                        className="simple-button"
                                        value={playButtonLabel}
                                        onClick={() =>
                                            this.props.onGameLaunch(game.id)
                                        }
                                    />
                                    {isGame ? (
                                        <input
                                            type="button"
                                            className="simple-button"
                                            disabled={!currentGame?.installed}
                                            value={strings.setup}
                                            onClick={() =>
                                                this.props.onGameLaunchSetup(
                                                    game.id
                                                )
                                            }
                                        />
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* -- Game Image Carousel -- */}
                    <div className="browse-right-sidebar__section">
                        <GameImageCarousel
                            imgKey={game.id}
                            media={game.media}
                            platform={game.platform}
                            onPreviewMedia={this.onPreviewMedia}
                        />
                    </div>

                    {/* -- Most Fields -- */}
                    <div className="browse-right-sidebar__section">
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.tags}: </p>
                            <DropdownInputField
                                text={game.genre}
                                placeholder={strings.noTags}
                                className="browse-right-sidebar__searchable"
                                items={[]}
                                onItemSelect={(text) => {
                                    game.genre = text;
                                    this.forceUpdate();
                                }}
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.series}: </p>
                            <InputField
                                text={game.series}
                                placeholder={strings.noSeries}
                                className="browse-right-sidebar__searchable"
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.developer}: </p>
                            <InputField
                                text={game.developer}
                                placeholder={strings.noDeveloper}
                                className="browse-right-sidebar__searchable"
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.publisher}: </p>
                            <InputField
                                text={game.publisher}
                                placeholder={strings.noPublisher}
                                className="browse-right-sidebar__searchable"
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.source}: </p>
                            <InputField
                                text={game.source}
                                placeholder={strings.noSource}
                                className="browse-right-sidebar__searchable"
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.platform}: </p>
                            <DropdownInputField
                                text={game.platform}
                                placeholder={strings.noPlatform}
                                className="browse-right-sidebar__searchable"
                                items={[]}
                                onItemSelect={(text) => {
                                    game.platform = text;
                                    this.forceUpdate();
                                }}
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.playMode}: </p>
                            <DropdownInputField
                                text={game.playMode}
                                placeholder={strings.noPlayMode}
                                className="browse-right-sidebar__searchable"
                                items={[]}
                                onItemSelect={(text) => {
                                    game.playMode = text;
                                    this.forceUpdate();
                                }}
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.releaseYear}: </p>
                            <InputField
                                text={new Date(game.releaseYear)
                                    .getFullYear()
                                    .toString()}
                                placeholder={strings.noReleaseDate}
                                className="browse-right-sidebar__searchable"
                            />
                        </div>
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
                    {/* -- Notes -- */}
                    {game.notes ? (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row">
                                <p>{strings.notes}: </p>
                                <InputField
                                    text={game.notes}
                                    placeholder={strings.noNotes}
                                    multiline={true}
                                />
                            </div>
                        </div>
                    ) : undefined}
                    {/* -- Original Description -- */}
                    {game.originalDescription ? (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row">
                                <p>{strings.originalDescription}: </p>
                                <InputField
                                    text={game.originalDescription}
                                    placeholder={strings.noOriginalDescription}
                                    multiline={true}
                                />
                            </div>
                        </div>
                    ) : undefined}
                    {/* -- Additional Applications -- */}
                    {currentAddApps && currentAddApps.length > 0 && (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row browse-right-sidebar__row--additional-applications-header">
                                <p>{strings.addApps}:</p>
                            </div>
                            {currentAddApps &&
                                currentAddApps.map((addApp) => (
                                    <RightBrowseSidebarAddApp
                                        key={addApp.id}
                                        addApp={addApp}
                                        onLaunch={this.onAddAppLaunch.bind(
                                            this
                                        )}
                                    />
                                ))}
                        </div>
                    )}

                    {/* -- Media Preview -- */}
                    {this.state.previewMedia ? (
                        <MediaPreview
                            media={this.state.previewMedia}
                            onCancel={this.onPreviewMediaClick}
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
            this.props.onAddAppLaunch(addApp.id);
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

    onPreviewMedia = (media: FormattedGameMedia): void => {
        this.setState({ previewMedia: media });
    };

    onPreviewMediaClick = (): void => {
        this.setState({ previewMedia: undefined });
    };
}
