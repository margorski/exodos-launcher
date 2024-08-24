import * as React from "react";
import {
    BackIn,
    GetGameData,
    GetGameResponseData,
    LaunchGameData,
} from "@shared/back/types";
import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import { IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist, GamePlaylistEntry } from "@shared/interfaces";
import { memoizeOne } from "@shared/memoize";
import { updatePreferencesData } from "@shared/preferences/util";
import { formatString } from "@shared/utils/StringFormatter";
import { ConnectedLeftBrowseSidebar } from "../../containers/ConnectedLeftBrowseSidebar";
import { ConnectedRightBrowseSidebar } from "../../containers/ConnectedRightBrowseSidebar";
import {
    WithPreferencesProps,
    withPreferences,
} from "../../containers/withPreferences";
import { gameScaleSpan } from "../../Util";
import { GameGrid } from "../GameGrid";
import { GameList } from "../GameList";
import { GameOrderChangeEvent } from "../GameOrder";
import { InputElement } from "../InputField";
import { ResizableSidebar, SidebarResizeEvent } from "../ResizableSidebar";
import { englishTranslation } from "@renderer/lang/en";
import { RootState } from "@renderer/redux/store";
import { ConnectedProps, connect } from "react-redux";
import {
    forceSearch,
    selectGame,
    selectPlaylist,
} from "@renderer/redux/searchSlice";
import { SearchBar } from "../SearchBar";

export type BrowsePageProps = {
    playlists: GamePlaylist[];
    playlistIconCache: Record<string, string>;

    /** Current parameters for ordering games. */
    order?: GameOrderChangeEvent;
    /** Scale of the games. */
    gameScale: number;
    /** Layout of the games. */
    gameLayout: BrowsePageLayout;
    /** "Route" of the currently selected library (empty string means no library). */
    gameLibrary: string;
    /** Key to force game refresh */
    refreshKey: number;
};

export type BrowsePageState = {
    /** Current quick search string (used to jump to a game in the list, not to filter the list). */
    quickSearch: string;
    /** Currently dragged game (if any). */
    draggedGameId?: string;

    /** Buffer for the playlist notes of the selected game/playlist (all changes are made to the game until saved). */
    currentPlaylistNotes?: string;

    /** Buffer for the selected playlist (all changes are made to this until saved). */
    currentPlaylist?: GamePlaylist;
    currentPlaylistFilename?: string;
};

const mapState = (state: RootState) => ({
    searchState: state.searchState,
    games: state.gamesState.games,
    addApps: state.gamesState.addApps,
});

const mapDispatch = {
    onSelectPlaylist: selectPlaylist,
    onSelectGame: selectGame,
    forceSearch: forceSearch,
};

const connector = connect(mapState, mapDispatch);

type ConnectedBrowsePageProps = BrowsePageProps &
    WithPreferencesProps &
    ConnectedProps<typeof connector>;

/** Page displaying the games and playlists. */
class BrowsePage extends React.Component<
    ConnectedBrowsePageProps,
    BrowsePageState
> {
    /** Reference of the game grid/list element. */
    gameGridOrListRef: HTMLDivElement | null = null;
    /** A timestamp of the previous the the quick search string was updated */
    _prevQuickSearchUpdate: number = 0;
    gameBrowserRef: React.RefObject<HTMLDivElement> = React.createRef();
    /** The "setState" function but bound to this instance. */
    boundSetState = this.setState.bind(this);

    /** Time it takes before the current "quick search" string to reset after a change was made (in milliseconds). */
    static readonly quickSearchTimeout: number = 1500;

    constructor(props: ConnectedBrowsePageProps) {
        super(props);
        // Set initial state (this is set up to remove all "setState" calls)
        const initialState: BrowsePageState = {
            quickSearch: "",
        };
        this.state = initialState;
    }

    componentDidMount() {
        const view = this.props.searchState.views[this.props.gameLibrary];
        if (view && view.games.length === 0) {
            // No games found, force a search incase it hasn't tried to load yet
            this.props.forceSearch({
                view: this.props.gameLibrary,
            });
        }

        updatePreferencesData({
            browsePageShowLeftSidebar: !!this.props.playlists.length,
        });
    }

    componentDidUpdate(prevProps: BrowsePageProps, prevState: BrowsePageState) {
        if (prevProps.gameLibrary !== this.props.gameLibrary) {
            const view = this.props.searchState.views[this.props.gameLibrary];
            if (view && view.games.length === 0) {
                // No games found, force a search incase it hasn't tried to load yet
                this.props.forceSearch({
                    view: this.props.gameLibrary,
                });
            }
        }

        if (this.props.playlists !== prevProps.playlists) {
            updatePreferencesData({
                browsePageShowLeftSidebar: !!this.props.playlists.length,
            });
        }
    }

    render() {
        const { searchState, gameLibrary } = this.props;
        const { draggedGameId } = this.state;
        const view = searchState.views[gameLibrary];
        const order = this.props.order || BrowsePage.defaultOrder;

        // Find selected game
        const selectedGame = view?.selectedGame;
        const selectedAddApps = selectedGame
            ? this.props.addApps.filter((a) => a.gameId === selectedGame.id)
            : [];

        // Find the selected game in the selected playlist
        let gamePlaylistEntry: GamePlaylistEntry | undefined;
        if (view && view.selectedPlaylist && selectedGame) {
            gamePlaylistEntry = view.selectedPlaylist.games.find(
                (g) => g.id === selectedGame.id
            );
        }

        // Render
        return (
            <div className="game-browser" ref={this.gameBrowserRef}>
                <ResizableSidebar
                    hide={this.props.preferencesData.browsePageShowLeftSidebar}
                    divider="after"
                    width={
                        this.props.preferencesData.browsePageLeftSidebarWidth
                    }
                    onResize={this.onLeftSidebarResize}
                >
                    <ConnectedLeftBrowseSidebar
                        playlists={this.props.playlists}
                        currentPlaylist={view?.selectedPlaylist}
                        playlistIconCache={this.props.playlistIconCache}
                        onItemClick={this.onPlaylistClick}
                        onSetIcon={this.onPlaylistSetIcon}
                        onTitleChange={this.onPlaylistTitleChange}
                        onAuthorChange={this.onPlaylistAuthorChange}
                        onDescriptionChange={this.onPlaylistDescriptionChange}
                        onFilenameChange={this.onPlaylistFilenameChange}
                        onShowAllClick={this.onLeftSidebarShowAllClick}
                    />
                </ResizableSidebar>
                <div
                    className="game-browser__center"
                    onKeyDown={this.onCenterKeyDown}
                >
                    <SearchBar view={this.props.gameLibrary} />
                    {(() => {
                        const installedGameIds =
                            this.props.playlists.length > 0
                                ? this.props.playlists[0].games.map((g) => g.id)
                                : [];
                        if (this.props.gameLayout === BrowsePageLayout.grid) {
                            // (These are kind of "magic numbers" and the CSS styles are designed to fit with them)
                            const height: number = calcScale(
                                350,
                                this.props.gameScale
                            );
                            const width: number = (height * 0.7) | 0;
                            return (
                                <GameGrid
                                    games={view?.games}
                                    installedGameIds={installedGameIds}
                                    gamesTotal={view?.games.length}
                                    selectedGame={view?.selectedGame}
                                    draggedGameId={draggedGameId}
                                    noRowsRenderer={this.noRowsRendererMemo()}
                                    onGameSelect={this.onGameSelect}
                                    onGameLaunch={this.onGameLaunch}
                                    orderBy={order.orderBy}
                                    orderReverse={order.orderReverse}
                                    cellWidth={width}
                                    cellHeight={height}
                                    gridRef={this.gameGridOrListRefFunc}
                                />
                            );
                        } else {
                            const height: number = calcScale(
                                30,
                                this.props.gameScale
                            );
                            return (
                                <GameList
                                    games={view?.games}
                                    installedGameIds={installedGameIds}
                                    gamesTotal={view?.games.length}
                                    selectedGame={view?.selectedGame}
                                    draggedGameId={draggedGameId}
                                    noRowsRenderer={this.noRowsRendererMemo()}
                                    onGameSelect={this.onGameSelect}
                                    onGameLaunch={this.onGameLaunch}
                                    orderBy={order.orderBy}
                                    orderReverse={order.orderReverse}
                                    rowHeight={height}
                                    listRef={this.gameGridOrListRefFunc}
                                />
                            );
                        }
                    })()}
                </div>
                <ResizableSidebar
                    hide={this.props.preferencesData.browsePageShowRightSidebar}
                    divider="before"
                    width={
                        this.props.preferencesData.browsePageRightSidebarWidth
                    }
                    onResize={this.onRightSidebarResize}
                >
                    <ConnectedRightBrowseSidebar
                        currentGame={selectedGame}
                        currentAddApps={selectedAddApps}
                        currentPlaylistNotes={this.state.currentPlaylistNotes}
                        currentLibrary={this.props.gameLibrary}
                        gamePlaylistEntry={gamePlaylistEntry}
                        onGameLaunch={this.onGameLaunch}
                        onGameLaunchSetup={this.onGameLaunchSetup}
                        onAddAppLaunch={this.onAddAppLaunch}
                    />
                </ResizableSidebar>
            </div>
        );
    }

    private noRowsRendererMemo = memoizeOne(() => {
        const strings = englishTranslation.browse;
        const view = this.props.searchState.views[this.props.gameLibrary];
        const gamesTotal = view ? view.games.length : 0;

        return () => (
            <div className="game-list__no-games">
                {view && view.selectedPlaylist ? (
                    /* Empty Playlist */
                    <>
                        <h2 className="game-list__no-games__title">
                            {strings.emptyPlaylist}
                        </h2>
                        <br />
                        <p>
                            {formatString(
                                strings.dropGameOnLeft,
                                <i>{strings.leftSidebar}</i>
                            )}
                        </p>
                    </>
                ) : (
                    /* No games found */
                    <>
                        <h1 className="game-list__no-games__title">
                            {strings.noGamesFound}
                        </h1>
                        <br />
                        {gamesTotal > 0 ? (
                            <>
                                {strings.noGameMatchedDesc}
                                <br />
                                {strings.noGameMatchedSearch}
                            </>
                        ) : (
                            <>{strings.thereAreNoGames}</>
                        )}
                    </>
                )}
            </div>
        );
    });

    onLeftSidebarResize = (event: SidebarResizeEvent): void => {
        const maxWidth =
            this.getGameBrowserDivWidth() -
            this.props.preferencesData.browsePageRightSidebarWidth -
            5;
        const targetWidth =
            event.startWidth + event.event.clientX - event.startX;
        updatePreferencesData({
            browsePageLeftSidebarWidth: Math.min(targetWidth, maxWidth),
        });
    };

    onRightSidebarResize = (event: SidebarResizeEvent): void => {
        const maxWidth =
            this.getGameBrowserDivWidth() -
            this.props.preferencesData.browsePageLeftSidebarWidth -
            5;
        const targetWidth =
            event.startWidth + event.startX - event.event.clientX;
        updatePreferencesData({
            browsePageRightSidebarWidth: Math.min(targetWidth, maxWidth),
        });
    };

    getGameBrowserDivWidth(): number {
        if (!document.defaultView) {
            throw new Error('"document.defaultView" missing.');
        }
        if (!this.gameBrowserRef.current) {
            throw new Error('"game-browser" div is missing.');
        }
        return parseInt(
            document.defaultView.getComputedStyle(this.gameBrowserRef.current)
                .width || "",
            10
        );
    }

    onGameSelect = (game?: IGameInfo): void => {
        const view = this.props.searchState.views[this.props.gameLibrary];

        if (view?.selectedGame?.id !== game?.id) {
            this.props.onSelectGame({
                view: this.props.gameLibrary,
                game,
            });
        }
    };

    onGameLaunch = (gameId: string): void => {
        const game = this.props.games.find((g) => g.id === gameId);
        const addApps = this.props.addApps.filter((a) => a.gameId === gameId);
        if (game) {
            window.External.back.send<LaunchGameData>(BackIn.LAUNCH_GAME, {
                game,
                addApps,
            });
        }
    };

    onGameLaunchSetup = (gameId: string): void => {
        const game = this.props.games.find((g) => g.id === gameId);
        const addApps = this.props.addApps.filter((a) => a.gameId === gameId);
        if (game) {
            window.External.back.send<LaunchGameData>(
                BackIn.LAUNCH_GAME_SETUP,
                {
                    game,
                    addApps,
                }
            );
        }
    };

    onAddAppLaunch = (addAppId: string): void => {
        const addApp = this.props.addApps.find((a) => a.id === addAppId);
        if (addApp) {
            const game = this.props.games.find((g) => g.id === addApp.gameId);
            if (game) {
                window.External.back.send<LaunchGameData>(
                    BackIn.LAUNCH_ADDAPP,
                    {
                        game,
                        addApp,
                    }
                );
            }
        }
    };

    onCenterKeyDown = (event: React.KeyboardEvent): void => {
        const key: string = event.key.toLowerCase();
        if (!event.ctrlKey && !event.altKey) {
            // (Don't add CTRL or ALT modified key presses)
            if (key === "backspace") {
                // (Backspace - Remove a character)
                const timedOut = updateTime.call(this);
                let newString: string = timedOut ? "" : this.state.quickSearch;
                newString = newString.substr(0, newString.length - 1);
                this.setState({ quickSearch: newString });
            } else if (key.length === 1) {
                // (Single character - add it to the search string)
                const timedOut = updateTime.call(this);
                let newString: string =
                    (timedOut ? "" : this.state.quickSearch) + key;
                this.setState({ quickSearch: newString });
            }
        }

        /** Check if the current quick search has timed out (and should reset). */
        function updateTime(this: BrowsePage): boolean {
            const now: number = Date.now();
            const timedOut: boolean =
                now - this._prevQuickSearchUpdate >
                BrowsePage.quickSearchTimeout;
            this._prevQuickSearchUpdate = now;
            return timedOut;
        }
    };

    onPlaylistClick = (playlist: GamePlaylist, selected: boolean): void => {
        if (!selected) {
            this.props.onSelectPlaylist({
                view: this.props.gameLibrary,
                playlist,
            });
        }
    };

    onPlaylistSetIcon = () => {
        if (this.state.currentPlaylist) {
            // Synchronously show a "open dialog" (this makes the main window "frozen" while this is open)
            const filePaths = window.External.showOpenDialogSync({
                title: "Select the eXoDOS root directory",
                properties: ["openFile"],
            });
            if (filePaths && filePaths.length > 0) {
                toDataURL(filePaths[0]).then((dataUrl) => {
                    if (this.state.currentPlaylist) {
                        this.setState({
                            currentPlaylist: {
                                ...this.state.currentPlaylist,
                                icon: dataUrl + "",
                            },
                        });
                    }
                });
            }
        }
    };

    onPlaylistTitleChange = (event: React.ChangeEvent<InputElement>) => {
        if (this.state.currentPlaylist) {
            this.setState({
                currentPlaylist: {
                    ...this.state.currentPlaylist,
                    title: event.target.value,
                },
            });
        }
    };

    onPlaylistAuthorChange = (event: React.ChangeEvent<InputElement>) => {
        if (this.state.currentPlaylist) {
            this.setState({
                currentPlaylist: {
                    ...this.state.currentPlaylist,
                    author: event.target.value,
                },
            });
        }
    };

    onPlaylistDescriptionChange = (event: React.ChangeEvent<InputElement>) => {
        if (this.state.currentPlaylist) {
            this.setState({
                currentPlaylist: {
                    ...this.state.currentPlaylist,
                    description: event.target.value,
                },
            });
        }
    };

    onPlaylistFilenameChange = (event: React.ChangeEvent<InputElement>) => {
        if (this.state.currentPlaylist) {
            this.setState({
                currentPlaylist: {
                    ...this.state.currentPlaylist,
                    filename: event.target.value,
                },
            });
        }
    };

    onLeftSidebarShowAllClick = (): void => {
        const { onSelectPlaylist, gameLibrary } = this.props;
        if (onSelectPlaylist) {
            onSelectPlaylist({
                view: gameLibrary,
                playlist: undefined,
            });
        }
    };

    /** Focus the game grid/list (if this has a reference to one). */
    focusGameGridOrList() {
        // Focus the game grid/list (to make the keyboard inputs work)
        setTimeout(() => {
            if (this.gameGridOrListRef) {
                this.gameGridOrListRef.focus();
            }
        }, 0);
    }

    gameGridOrListRefFunc = (ref: HTMLDivElement | null): void => {
        this.gameGridOrListRef = ref;
    };

    static defaultOrder: Readonly<GameOrderChangeEvent> = {
        orderBy: "title",
        orderReverse: "ascending",
    };
}

export default withPreferences(connector(BrowsePage));

function calcScale(defHeight: number, scale: number): number {
    return (defHeight + (scale - 0.5) * 2 * defHeight * gameScaleSpan) | 0;
}

type FileReaderResult = (typeof FileReader)["prototype"]["result"];

/**
 * Convert the body of a URL to a data URL.
 * This will reject if the request or conversion fails.
 * @param url URL of content to convert.
 */
async function toDataURL(url: string): Promise<FileReaderResult> {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<FileReaderResult>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
