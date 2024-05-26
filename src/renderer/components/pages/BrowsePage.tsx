import * as React from "react";
import {
    BackIn,
    GetGameData,
    GetGameResponseData,
    LaunchGameData,
} from "@shared/back/types";
import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist, GamePlaylistEntry } from "@shared/interfaces";
import { memoizeOne } from "@shared/memoize";
import { updatePreferencesData } from "@shared/preferences/util";
import { formatString } from "@shared/utils/StringFormatter";
import { ConnectedLeftBrowseSidebar } from "../../containers/ConnectedLeftBrowseSidebar";
import { ConnectedRightBrowseSidebar } from "../../containers/ConnectedRightBrowseSidebar";
import { WithPreferencesProps } from "../../containers/withPreferences";
import { GAMES } from "../../interfaces";
import { SearchQuery } from "../../store/search";
import { gameScaleSpan } from "../../Util";
import { GameGrid } from "../GameGrid";
import { GameList } from "../GameList";
import { GameOrderChangeEvent } from "../GameOrder";
import { InputElement } from "../InputField";
import { ResizableSidebar, SidebarResizeEvent } from "../ResizableSidebar";
import { englishTranslation } from "@renderer/lang/en";

type OwnProps = {
    games: GAMES | undefined;
    gamesTotal: number;
    playlists: GamePlaylist[];
    playlistIconCache: Record<string, string>;
    onRequestGames: (start: number, end: number) => void;
    onQuickSearch: (search: string) => void;

    /** Most recent search query. */
    search: SearchQuery;
    /** Current parameters for ordering games. */
    order?: GameOrderChangeEvent;
    /** Scale of the games. */
    gameScale: number;
    /** Layout of the games. */
    gameLayout: BrowsePageLayout;
    /** Currently selected game (if any). */
    selectedGameId?: string;
    /** Currently selected playlist (if any). */
    selectedPlaylistId?: string;
    /** Called when a game is selected. */
    onSelectGame: (gameId?: string) => void;
    /** Called when a playlist is selected. */
    onSelectPlaylist: (library: string, playlistId: string | undefined) => void;
    /** Clear the current search query (resets the current search filters). */
    clearSearch: () => void;
    /** "Route" of the currently selected library (empty string means no library). */
    gameLibrary: string;
};

export type BrowsePageProps = OwnProps & WithPreferencesProps;

export type BrowsePageState = {
    /** Current quick search string (used to jump to a game in the list, not to filter the list). */
    quickSearch: string;
    /** Currently dragged game (if any). */
    draggedGameId?: string;

    /** Buffer for the selected game (all changes are made to the game until saved). */
    currentGame?: IGameInfo;
    /** Buffer for the selected games additional applications (all changes are made to this until saved). */
    currentAddApps?: IAdditionalApplicationInfo[];
    /** Buffer for the playlist notes of the selected game/playlist (all changes are made to the game until saved). */
    currentPlaylistNotes?: string;

    /** Buffer for the selected playlist (all changes are made to this until saved). */
    currentPlaylist?: GamePlaylist;
    currentPlaylistFilename?: string;
};

export interface BrowsePage {}

/** Page displaying the games and playlists. */
export class BrowsePage extends React.Component<
    BrowsePageProps,
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

    constructor(props: BrowsePageProps) {
        super(props);
        // Set initial state (this is set up to remove all "setState" calls)
        const initialState: BrowsePageState = {
            quickSearch: "",
        };
        this.updateCurrentGameAndAddApps();
        this.state = initialState;
    }

    componentDidMount() {
        updatePreferencesData({
            browsePageShowLeftSidebar: !!this.props.playlists.length,
        });
    }

    componentDidUpdate(prevProps: BrowsePageProps, prevState: BrowsePageState) {
        const { gameLibrary, selectedGameId, selectedPlaylistId } = this.props;
        const { quickSearch } = this.state;

        if (this.props.playlists !== prevProps.playlists) {
            updatePreferencesData({
                browsePageShowLeftSidebar: !!this.props.playlists.length,
            });
        }

        // Update current game and add-apps if the selected game changes
        if (selectedGameId && selectedGameId !== prevProps.selectedGameId) {
            this.updateCurrentGameAndAddApps();
        }
        // Deselect the current game ad add-apps if the game has been deselected (from outside this component most likely)
        if (
            selectedGameId === undefined &&
            (this.state.currentGame || this.state.currentAddApps)
        ) {
            this.setState({
                currentGame: undefined,
                currentAddApps: undefined,
                currentPlaylistNotes: undefined,
            });
        }
        // Update current game and add-apps if the selected game changes
        if (
            gameLibrary === prevProps.gameLibrary &&
            selectedPlaylistId !== prevProps.selectedPlaylistId
        ) {
            this.setState({
                currentGame: undefined,
                currentAddApps: undefined,
            });
        }
        // Check if quick search string changed, and if it isn't empty
        if (prevState.quickSearch !== quickSearch && quickSearch !== "") {
            this.props.onQuickSearch(quickSearch);
        }
        // Check the library selection changed (and no game is selected)
        if (!selectedGameId && gameLibrary !== prevProps.gameLibrary) {
            if (this.props.clearSearch) {
                this.props.clearSearch();
            }
            this.setState({
                currentGame: undefined,
                currentAddApps: undefined,
            });
        }
    }

    render() {
        const { games, playlists, selectedGameId, selectedPlaylistId } =
            this.props;
        const { draggedGameId } = this.state;
        const order = this.props.order || BrowsePage.defaultOrder;

        // Find the selected game in the selected playlist
        let gamePlaylistEntry: GamePlaylistEntry | undefined;
        if (selectedPlaylistId && selectedGameId) {
            const playlist = playlists.find(
                (p) => p.filename === selectedPlaylistId
            );
            if (playlist) {
                gamePlaylistEntry = playlist.games.find(
                    (g) => g.id === selectedGameId
                );
            }
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
                        selectedPlaylistID={selectedPlaylistId || ""}
                        currentPlaylist={this.state.currentPlaylist}
                        currentPlaylistFilename={
                            this.state.currentPlaylistFilename
                        }
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
                                    games={games}
                                    installedGameIds={installedGameIds}
                                    gamesTotal={this.props.gamesTotal}
                                    selectedGameId={selectedGameId}
                                    draggedGameId={draggedGameId}
                                    noRowsRenderer={this.noRowsRendererMemo()}
                                    onGameSelect={this.onGameSelect}
                                    onGameLaunch={this.onGameLaunch}
                                    onRequestGames={this.props.onRequestGames}
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
                                    games={games}
                                    installedGameIds={installedGameIds}
                                    gamesTotal={this.props.gamesTotal}
                                    selectedGameId={selectedGameId}
                                    draggedGameId={draggedGameId}
                                    noRowsRenderer={this.noRowsRendererMemo()}
                                    onGameSelect={this.onGameSelect}
                                    onGameLaunch={this.onGameLaunch}
                                    onRequestGames={this.props.onRequestGames}
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
                        currentGame={this.state.currentGame}
                        currentAddApps={this.state.currentAddApps}
                        currentPlaylistNotes={this.state.currentPlaylistNotes}
                        currentLibrary={this.props.gameLibrary}
                        onDeselectPlaylist={this.onRightSidebarDeselectPlaylist}
                        gamePlaylistEntry={gamePlaylistEntry}
                        isInstalled={this.isCurrentGameInstalled()}
                    />
                </ResizableSidebar>
            </div>
        );
    }

    private isCurrentGameInstalled = () => {
        if (this.props.playlists.length === 0 || !this.state.currentGame)
            return false;
        const gameId = this.state.currentGame.id;

        return this.isGameInstalled(gameId);
    };

    private isGameInstalled = (gameId: string) =>
        this.props.playlists[0].games.findIndex((g) => g.id === gameId) !== -1;

    private noRowsRendererMemo = memoizeOne(() => {
        const strings = englishTranslation.browse;
        return () => (
            <div className="game-list__no-games">
                {this.props.selectedPlaylistId ? (
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
                        {this.props.gamesTotal > 0 ? (
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

    /** Deselect without clearing search (Right sidebar will search itself) */
    onRightSidebarDeselectPlaylist = (): void => {
        const { onSelectPlaylist } = this.props;
        if (onSelectPlaylist) {
            onSelectPlaylist(this.props.gameLibrary, undefined);
        }
    };

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

    onGameSelect = (gameId?: string): void => {
        if (this.props.selectedGameId !== gameId) {
            this.props.onSelectGame(gameId);
        }
    };

    onGameLaunch = (gameId: string): void => {
        window.External.back.send<LaunchGameData>(BackIn.LAUNCH_GAME, {
            id: gameId,
        });
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

    /** Replace the "current game" with the selected game (in the appropriate circumstances) */
    async updateCurrentGameAndAddApps(): Promise<void> {
        const gameId = this.props.selectedGameId;
        if (gameId !== undefined) {
            // Find the selected game in the selected playlist
            const playlistId = this.props.selectedPlaylistId;
            let notes: string | undefined;
            if (playlistId && gameId) {
                const playlist = this.props.playlists.find(
                    (p) => p.filename === playlistId
                );
                if (playlist) {
                    const entry = playlist.games.find((g) => g.id === gameId);
                }
            }

            window.External.back.send<GetGameResponseData, GetGameData>(
                BackIn.GET_GAME,
                { id: gameId },
                (res) => {
                    if (res.data) {
                        if (res.data.game) {
                            this.setState({
                                currentGame: res.data.game,
                                currentAddApps: res.data.addApps || [],
                                currentPlaylistNotes: notes,
                            });
                        } else {
                            console.log(
                                `Failed to get game. Game is undefined (GameID: "${gameId}").`
                            );
                        }
                    } else {
                        console.log(
                            `Failed to get game. Empty data in response (GameID: "${gameId}").`
                        );
                    }
                }
            );
        }
    }

    onPlaylistClick = (playlistId: string, selected: boolean): void => {
        if (!selected) {
            this.setState({
                currentPlaylist: undefined,
                currentPlaylistFilename: undefined,
            });
            this.props.clearSearch();
            this.props.onSelectPlaylist(
                this.props.gameLibrary,
                this.props.selectedPlaylistId !== playlistId
                    ? playlistId
                    : undefined
            );
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
        const { clearSearch, onSelectPlaylist } = this.props;
        if (clearSearch) {
            clearSearch();
        }
        if (onSelectPlaylist) {
            onSelectPlaylist(this.props.gameLibrary, undefined);
        }
        this.setState({
            currentPlaylist: undefined,
            currentPlaylistFilename: undefined,
            currentGame: undefined,
            currentAddApps: undefined,
            currentPlaylistNotes: undefined,
        });
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
