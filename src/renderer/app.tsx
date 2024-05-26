import { ipcRenderer } from "electron";
import { app, dialog } from "@electron/remote";
import { UpdateInfo } from "electron-updater";
import * as React from "react";
import {
    AddLogData,
    BackIn,
    BackInit,
    BackOut,
    BrowseChangeData,
    BrowseViewIndexData,
    BrowseViewIndexResponseData,
    BrowseViewPageData,
    BrowseViewPageResponseData,
    GetGamesTotalResponseData,
    GetPlaylistResponse,
    InitEventData,
    LaunchGameData,
    LocaleUpdateData,
    LogEntryAddedData,
    PlaylistRemoveData,
    PlaylistUpdateData,
    QuickSearchData,
    QuickSearchResponseData,
    ThemeChangeData,
    ThemeListChangeData,
} from "@shared/back/types";
import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import { APP_TITLE } from "@shared/constants";
import { UNKNOWN_LIBRARY } from "@shared/game/interfaces";
import { ExodosBackendInfo, GamePlaylist, WindowIPC } from "@shared/interfaces";
import { getLibraryItemTitle } from "@shared/library/util";
import { memoizeOne } from "@shared/memoize";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import { updatePreferencesData } from "@shared/preferences/util";
import { setTheme } from "@shared/Theme";
import { Theme } from "@shared/ThemeFile";
import { getFileServerURL } from "@shared/Util";
import { GameOrderChangeEvent } from "./components/GameOrder";
import { SplashScreen } from "./components/SplashScreen";
import { TitleBar } from "./components/TitleBar";
import { ConnectedFooter } from "./containers/ConnectedFooter";
import HeaderContainer from "./containers/HeaderContainer";
import { WithPreferencesProps } from "./containers/withPreferences";
import { GAMES } from "./interfaces";
import { Paths } from "./Paths";
import { AppRouter, AppRouterProps } from "./router";
import { SearchQuery } from "./store/search";
import { joinLibraryRoute } from "./Util";
import { debounce } from "@shared/utils/debounce";
import { WithRouterProps } from "./containers/withRouter";
// Auto updater works only with .appImage distribution. We are using .tar.gz
// so it will just fail silently. Code is left for future.

const VIEW_PAGE_SIZE = 250;

type Views = Record<string, View | undefined>; // views[id] = view
type View = {
    games: GAMES;
    pages: Record<number, ViewPage | undefined>;
    total: number;
    selectedPlaylistId?: string;
    selectedGameId?: string;
    /** If the cache is dirty and should be discarded. */
    dirtyCache: boolean;
    /** The most recent query used for this view. */
    query: {
        search: string;
        orderBy: GameOrderBy;
        orderReverse: GameOrderReverse;
    };
};
type ViewPage = {};

type AppOwnProps = {
    /** Most recent search query. */
    search: SearchQuery;
};

export type AppProps = AppOwnProps & WithRouterProps & WithPreferencesProps;

export type AppState = {
    views: Views;
    libraries: string[];
    playlists: GamePlaylist[];
    playlistIconCache: Record<string, string>; // [PLAYLIST_ID] = ICON_BLOB_URL
    appPaths: Record<string, string>;
    platforms: Record<string, string[]>;
    loaded: { [key in BackInit]: boolean };
    themeList: Theme[];
    gamesTotal: number;
    localeCode: string;

    /** Stop rendering to force component unmounts */
    stopRender: boolean;
    /** Current parameters for ordering games. */
    order: GameOrderChangeEvent;
    /** Scale of the games. */
    gameScale: number;
    /** Layout of the browse page */
    gameLayout: BrowsePageLayout;
    /** If the "New Game" button was clicked (silly way of passing the event from the footer the the browse page). */
    wasNewGameClicked: boolean;
    /** Info of the update, if one was found */
    updateInfo: UpdateInfo | undefined;
    /** Exodos backend info for displaying at homepage  */
    exodosBackendInfo: ExodosBackendInfo | undefined;
};

export class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);

        const preferencesData = this.props.preferencesData;
        const order: GameOrderChangeEvent = {
            orderBy: preferencesData.gamesOrderBy,
            orderReverse: preferencesData.gamesOrder,
        };

        // Prepare libraries
        const libraries = Object.keys(window.External.initialPlatforms).sort();

        // Prepare initial views
        const views: Record<string, View> = {};
        for (let library of libraries) {
            views[library] = {
                dirtyCache: false,
                games: {},
                pages: {},
                total: 0,
                query: {
                    search: this.props.search.text,
                    orderBy: order.orderBy,
                    orderReverse: order.orderReverse,
                },
            };
        }

        // Prepare platforms
        const platforms: Record<string, string[]> = {};
        for (let library of libraries) {
            platforms[library] = window.External.initialPlatforms[library]
                .slice()
                .sort();
        }

        // Set initial state
        this.state = {
            views: views,
            libraries: libraries,
            playlists: window.External.initialPlaylists || [],
            playlistIconCache: {},
            appPaths: {},
            platforms: platforms,
            loaded: {
                0: false,
                1: false,
                2: false,
            },
            themeList: window.External.initialThemes,
            gamesTotal: -1,
            localeCode: window.External.initialLocaleCode,
            stopRender: false,
            gameScale: preferencesData.browsePageGameScale,
            gameLayout: preferencesData.browsePageLayout,
            wasNewGameClicked: false,
            updateInfo: undefined,
            order,
            exodosBackendInfo: undefined,
        };

        // Initialize app
        this.init();
    }

    async initializeExodosBackendInfo() {
        const changelogRequest = await fetch(
            `${getFileServerURL()}/eXo/Update/changelog.txt`
        );
        const changelog = await changelogRequest.text();

        const versionRequest = await fetch(
            `${getFileServerURL()}/eXo/Update/ver/ver_linux.txt`
        );
        const version = await versionRequest.text();

        this.setState({
            ...this.state,
            exodosBackendInfo: {
                changelog: changelog,
                version: version.split(" ")[1],
            },
        });
    }

    init() {
        // Warn the user when closing the launcher WHILE downloading or installing an upgrade
        (() => {
            let askBeforeClosing = true;
            window.onbeforeunload = (event: BeforeUnloadEvent) => {
                let stillDownloading = false;
                if (askBeforeClosing && stillDownloading) {
                    event.returnValue = 1; // (Prevent closing the window)
                    dialog
                        .showMessageBox({
                            type: "warning",
                            title: "Exit Launcher?",
                            message:
                                "All progress on downloading or installing the upgrade will be lost.\n" +
                                "Are you sure you want to exit?",
                            buttons: ["Yes", "No"],
                            defaultId: 1,
                            cancelId: 1,
                        })
                        .then(({ response }) => {
                            if (response === 0) {
                                askBeforeClosing = false;
                                this.unmountBeforeClose();
                            }
                        });
                } else {
                    this.unmountBeforeClose();
                }
            };
        })();

        this.initializeExodosBackendInfo();

        // Listen for the window to move or resize (and update the preferences when it does)
        ipcRenderer.on(
            WindowIPC.WINDOW_MOVE,
            debounce((_, x: number, y: number, isMaximized: boolean) => {
                if (!isMaximized) {
                    updatePreferencesData({
                        mainWindow: { x: x | 0, y: y | 0 },
                    });
                }
            }, 100)
        );
        ipcRenderer.on(
            WindowIPC.WINDOW_RESIZE,
            debounce(
                (_, width: number, height: number, isMaximized: boolean) => {
                    if (!isMaximized) {
                        updatePreferencesData({
                            mainWindow: {
                                width: width | 0,
                                height: height | 0,
                            },
                        });
                    }
                },
                100
            )
        );
        ipcRenderer.on(WindowIPC.WINDOW_MAXIMIZE, (_, isMaximized: boolean) => {
            updatePreferencesData({
                mainWindow: { maximized: isMaximized },
            });
        });

        window.External.back.send<InitEventData>(
            BackIn.INIT_LISTEN,
            undefined,
            (res) => {
                if (!res.data) {
                    throw new Error("INIT_LISTEN response is missing data.");
                }
                const nextLoaded = { ...this.state.loaded };
                for (let key of res.data.done) {
                    nextLoaded[key] = true;
                }
                this.setState({ loaded: nextLoaded });
            }
        );

        window.External.back.on("message", (res) => {
            console.log(`Message from backend: ${BackOut[res.type]}`);
            switch (res.type) {
                case BackOut.INIT_EVENT:
                    {
                        const resData: InitEventData = res.data;

                        const loaded = { ...this.state.loaded };
                        for (let index of resData.done) {
                            loaded[index] = true;

                            switch (
                                parseInt(index + "", 10) // (It is a string, even though TS thinks it is a number)
                            ) {
                                case BackInit.PLAYLISTS:
                                    window.External.back.send<GetPlaylistResponse>(
                                        BackIn.GET_PLAYLISTS,
                                        undefined,
                                        (res) => {
                                            if (res.data) {
                                                this.setState({
                                                    playlists: res.data,
                                                });
                                                this.cachePlaylistIcons(
                                                    res.data
                                                );
                                            }
                                        }
                                    );
                                    break;

                                case BackInit.GAMES:
                                    window.External.back.send<GetGamesTotalResponseData>(
                                        BackIn.GET_GAMES_TOTAL,
                                        undefined,
                                        (res) => {
                                            if (res.data) {
                                                this.setState({
                                                    gamesTotal: res.data,
                                                });
                                            }
                                        }
                                    );
                                    break;
                            }
                        }

                        this.setState({ loaded });
                    }
                    break;

                case BackOut.LOG_ENTRY_ADDED:
                    {
                        const resData: LogEntryAddedData = res.data;
                        window.External.log.entries[
                            resData.index - window.External.log.offset
                        ] = resData.entry;
                    }
                    break;

                case BackOut.LOCALE_UPDATE:
                    {
                        const resData: LocaleUpdateData = res.data;
                        this.setState({ localeCode: resData });
                    }
                    break;

                case BackOut.BROWSE_VIEW_PAGE_RESPONSE:
                    {
                        console.log("BACK OUT BROWSE VIEW PAGE RESPONSE");
                        const resData: BrowseViewPageResponseData = res.data;

                        console.log(resData);
                        // TODO: PREPARE FILTERING
                        let view: View | undefined = this.state.views[res.id];

                        if (view) {
                            const views = { ...this.state.views };
                            const newView = (views[res.id] = { ...view });
                            if (view.dirtyCache) {
                                newView.dirtyCache = false;
                                newView.games = {};
                                newView.pages = {};
                            } else {
                                newView.games = { ...view.games };
                            }
                            for (let i = 0; i < resData.games.length; i++) {
                                newView.games[resData.offset + i] =
                                    resData.games[i];
                            }
                            if (resData.total !== undefined) {
                                // Remove overflowing games
                                if (resData.total < newView.total) {
                                    const indices = Object.keys(newView.games);
                                    for (let i = 0; i < indices.length; i++) {
                                        const index = parseInt(indices[i], 10);
                                        if (index >= resData.total) {
                                            delete newView.games[index];
                                        }
                                    }
                                }
                                // Update total
                                newView.total = resData.total;
                            }
                            this.setState({ views });
                        }
                    }
                    break;

                case BackOut.BROWSE_CHANGE:
                    {
                        const resData: BrowseChangeData = res.data;
                        const newState: Partial<AppState> = {
                            gamesTotal: resData.gamesTotal,
                        };

                        if (resData.library) {
                            // (Clear specific cache)
                            const view = this.state.views[resData.library];
                            if (view) {
                                newState.views = {
                                    ...this.state.views,
                                    [resData.library]: {
                                        ...view,
                                        dirtyCache: true,
                                    },
                                };
                            }
                        } else {
                            // (Clear all caches)
                            const newViews = { ...this.state.views };
                            for (let library in newViews) {
                                const view = newViews[library];
                                if (view) {
                                    newViews[library] = {
                                        ...view,
                                        dirtyCache: true,
                                    };
                                }
                            }
                            newState.views = newViews;
                        }

                        this.setState(newState as any, () => {
                            this.requestSelectedGame(
                                resData.library ||
                                    getBrowseSubPath(
                                        this.props.location.pathname
                                    )
                            );
                        });
                    }
                    break;

                case BackOut.PLAYLIST_UPDATE:
                    {
                        const resData: PlaylistUpdateData = res.data;
                        const index = this.state.playlists.findIndex(
                            (p) => p.filename === resData.filename
                        );
                        if (index >= 0) {
                            const playlist = this.state.playlists[index];
                            const state: Partial<
                                Pick<
                                    AppState,
                                    "playlistIconCache" | "playlists" | "views"
                                >
                            > = {};

                            // Remove old icon from cache
                            if (
                                playlist.filename in
                                this.state.playlistIconCache
                            ) {
                                state.playlistIconCache = {
                                    ...this.state.playlistIconCache,
                                };
                                delete state.playlistIconCache[
                                    playlist.filename
                                ];
                                URL.revokeObjectURL(
                                    state.playlistIconCache[playlist.filename]
                                ); // Free blob from memory
                            }

                            // Cache new icon
                            if (resData.icon !== undefined) {
                                cacheIcon(resData.icon).then((url) => {
                                    this.setState({
                                        playlistIconCache: {
                                            ...this.state.playlistIconCache,
                                            [resData.filename]: url,
                                        },
                                    });
                                });
                            }

                            // Update playlist
                            state.playlists = [...this.state.playlists];
                            state.playlists[index] = resData;

                            // Clear view caches (that use this playlist)
                            for (let id in this.state.views) {
                                const view = this.state.views[id];
                                if (view) {
                                    if (
                                        view.selectedPlaylistId ===
                                        resData.filename
                                    ) {
                                        if (!state.views) {
                                            state.views = {
                                                ...this.state.views,
                                            };
                                        }
                                        state.views[id] = {
                                            ...view,
                                            dirtyCache: true,
                                        };
                                    }
                                }
                            }

                            this.setState(
                                state as any, // (This is very annoying to make typesafe)
                                () => {
                                    if (
                                        state.views &&
                                        resData.library !== undefined
                                    ) {
                                        this.requestSelectedGame(
                                            resData.library
                                        );
                                    }
                                }
                            );
                        } else {
                            this.setState({
                                playlists: [...this.state.playlists, resData],
                            });
                        }
                    }
                    break;

                case BackOut.PLAYLIST_REMOVE:
                    {
                        const resData: PlaylistRemoveData = res.data;

                        const index = this.state.playlists.findIndex(
                            (p) => p.filename === resData
                        );
                        if (index >= 0) {
                            const playlists = [...this.state.playlists];
                            playlists.splice(index, 1);

                            const cache: Record<string, string> = {
                                ...this.state.playlistIconCache,
                            };
                            const filename =
                                this.state.playlists[index].filename;
                            if (filename in cache) {
                                delete cache[filename];
                            }

                            this.setState({
                                playlists: playlists,
                                playlistIconCache: cache,
                            });
                        }
                    }
                    break;

                case BackOut.THEME_CHANGE:
                    {
                        const resData: ThemeChangeData = res.data;
                        if (
                            resData === this.props.preferencesData.currentTheme
                        ) {
                            setTheme(resData);
                        }
                    }
                    break;

                case BackOut.THEME_LIST_CHANGE:
                    {
                        const resData: ThemeListChangeData = res.data;
                        this.setState({ themeList: resData });
                    }
                    break;
            }
        });

        // Cache playlist icons (if they are loaded)
        if (this.state.playlists.length > 0) {
            this.cachePlaylistIcons(this.state.playlists);
        }
    }

    componentDidUpdate(prevProps: AppProps, prevState: AppState) {
        const { navigate, location, preferencesData } = this.props;
        const library = getBrowseSubPath(this.props.location.pathname);
        const prevLibrary = getBrowseSubPath(prevProps.location.pathname);
        const view = this.state.views[library];
        const prevView = prevState.views[prevLibrary];

        // Check if theme changed
        if (
            preferencesData.currentTheme !==
            prevProps.preferencesData.currentTheme
        ) {
            setTheme(preferencesData.currentTheme);
        }

        if (view) {
            // Check if the playlist selection changed
            if (
                view.selectedPlaylistId !==
                (prevView && prevView.selectedPlaylistId)
            ) {
                this.setState(
                    {
                        views: {
                            ...this.state.views,
                            [library]: {
                                ...view,
                                dirtyCache: true,
                            },
                        },
                    },
                    () => {
                        this.requestSelectedGame(library);
                    }
                );
            }

            // Check if the search query has changed
            if (
                view.query.search !== this.props.search.text ||
                view.query.orderBy !== this.state.order.orderBy ||
                view.query.orderReverse !== this.state.order.orderReverse
            ) {
                this.setState(
                    {
                        views: {
                            ...this.state.views,
                            [library]: {
                                ...view,
                                dirtyCache: true,
                                query: {
                                    ...view.query,
                                    search: this.props.search.text,
                                    orderBy: this.state.order.orderBy,
                                    orderReverse: this.state.order.orderReverse,
                                },
                            },
                        },
                    },
                    () => {
                        this.requestSelectedGame(library);
                    }
                );
            }
        }

        // Fetch games if a different library is selected
        if (library && prevLibrary && library !== prevLibrary) {
            this.requestSelectedGame(library);
        }

        // Update preference "lastSelectedLibrary"
        const gameLibrary = getBrowseSubPath(location.pathname);
        if (
            location.pathname.startsWith(Paths.BROWSE) &&
            preferencesData.lastSelectedLibrary !== gameLibrary
        ) {
            updatePreferencesData({ lastSelectedLibrary: gameLibrary });
        }

        // Create a new game
        if (this.state.wasNewGameClicked) {
            let route = "";
            if (preferencesData.lastSelectedLibrary) {
                route = preferencesData.lastSelectedLibrary;
            } else {
                const defaultLibrary = preferencesData.defaultLibrary;
                if (defaultLibrary) {
                    route = defaultLibrary;
                } else {
                    route = UNKNOWN_LIBRARY;
                }
            }

            if (location.pathname.startsWith(Paths.BROWSE)) {
                this.setState({ wasNewGameClicked: false });
                // Deselect the current game
                const view = this.state.views[route];
                if (view && view.selectedGameId !== undefined) {
                    const views = { ...this.state.views };
                    views[route] = {
                        ...view,
                        selectedGameId: undefined,
                    };
                    this.setState({ views });
                }
            } else {
                navigate(joinLibraryRoute(route));
            }
        }
    }

    render() {
        const loaded =
            this.state.loaded[BackInit.GAMES] &&
            this.state.loaded[BackInit.PLAYLISTS] &&
            this.state.loaded[BackInit.EXEC];
        const libraryPath = getBrowseSubPath(this.props.location.pathname);
        const view = this.state.views[libraryPath];
        const playlists = this.orderAndFilterPlaylistsMemo(
            this.state.playlists,
            libraryPath
        );

        // Props to set to the router
        const routerProps: AppRouterProps = {
            games: view && view.games,
            gamesTotal: view ? view.total : 0,
            playlists: playlists,
            appPaths: this.state.appPaths,
            platforms: this.state.platforms,
            platformsFlat: this.flattenPlatformsMemo(this.state.platforms),
            playlistIconCache: this.state.playlistIconCache,
            onLaunchGame: this.onLaunchGame,
            onRequestGames: this.onRequestGames,
            onQuickSearch: this.onQuickSearch,
            libraries: this.state.libraries,
            localeCode: this.state.localeCode,
            order: this.state.order,
            gameScale: this.state.gameScale,
            gameLayout: this.state.gameLayout,
            selectedGameId: view && view.selectedGameId,
            selectedPlaylistId: view && view.selectedPlaylistId,
            onSelectGame: this.onSelectGame,
            onSelectPlaylist: this.onSelectPlaylist,
            wasNewGameClicked: this.state.wasNewGameClicked,
            gameLibrary: libraryPath,
            themeList: this.state.themeList,
            updateInfo: this.state.updateInfo,
            exodosBackendInfo: this.state.exodosBackendInfo,
        };
        // Render
        return (
            <>
                {!this.state.stopRender ? (
                    <>
                        {/* Splash screen */}
                        <SplashScreen
                            gamesLoaded={this.state.loaded[BackInit.GAMES]}
                            playlistsLoaded={
                                this.state.loaded[BackInit.PLAYLISTS]
                            }
                            miscLoaded={this.state.loaded[BackInit.EXEC]}
                        />
                        {/* Title-bar (if enabled) */}
                        {window.External.config.data.useCustomTitlebar ? (
                            <TitleBar
                                title={`${APP_TITLE} (${app.getVersion()})`}
                            />
                        ) : undefined}
                        {/* "Content" */}
                        {loaded ? (
                            <>
                                {/* Header */}
                                <HeaderContainer
                                    libraries={this.state.libraries}
                                    onOrderChange={this.onOrderChange}
                                    onToggleLeftSidebarClick={
                                        this.onToggleLeftSidebarClick
                                    }
                                    onToggleRightSidebarClick={
                                        this.onToggleRightSidebarClick
                                    }
                                    order={this.state.order}
                                />
                                {/* Main */}
                                <div className="main">
                                    <AppRouter {...routerProps} />
                                    <noscript className="nojs">
                                        <div style={{ textAlign: "center" }}>
                                            This website requires JavaScript to
                                            be enabled.
                                        </div>
                                    </noscript>
                                </div>
                                {/* Footer */}
                                <ConnectedFooter
                                    totalCount={this.state.gamesTotal}
                                    currentLabel={
                                        libraryPath &&
                                        getLibraryItemTitle(libraryPath)
                                    }
                                    currentCount={view ? view.total : 0}
                                    onScaleSliderChange={
                                        this.onScaleSliderChange
                                    }
                                    scaleSliderValue={this.state.gameScale}
                                    onLayoutChange={this.onLayoutSelectorChange}
                                    layout={this.state.gameLayout}
                                />
                            </>
                        ) : undefined}
                    </>
                ) : undefined}
            </>
        );
    }

    private onOrderChange = (event: GameOrderChangeEvent): void => {
        const library = getBrowseSubPath(this.props.location.pathname);
        const view = this.state.views[library];
        if (view) {
            // @TODO I'm thinking about moving the order options to be specific to each view,
            //       instead of global. But maybe that is unnecessary and just adds complexity.
            this.setState(
                {
                    order: event,
                    views: {
                        ...this.state.views,
                        [library]: {
                            ...view,
                            dirtyCache: true,
                            query: {
                                ...view.query,
                                orderBy: event.orderBy,
                                orderReverse: event.orderReverse,
                            },
                        },
                    },
                },
                () => {
                    this.requestSelectedGame(library);
                }
            );
        }
        // Update Preferences Data (this is to make it get saved on disk)
        updatePreferencesData({
            gamesOrderBy: event.orderBy,
            gamesOrder: event.orderReverse,
        });
    };

    private onScaleSliderChange = (value: number): void => {
        this.setState({ gameScale: value });
        // Update Preferences Data (this is to make it get saved on disk)
        updatePreferencesData({ browsePageGameScale: value });
    };

    private onLayoutSelectorChange = (value: BrowsePageLayout): void => {
        this.setState({ gameLayout: value });
        // Update Preferences Data (this is to make it get saved on disk)
        updatePreferencesData({ browsePageLayout: value });
    };

    private onToggleLeftSidebarClick = (): void => {
        updatePreferencesData({
            browsePageShowLeftSidebar:
                !this.props.preferencesData.browsePageShowLeftSidebar,
        });
    };

    private onToggleRightSidebarClick = (): void => {
        updatePreferencesData({
            browsePageShowRightSidebar:
                !this.props.preferencesData.browsePageShowRightSidebar,
        });
    };

    private onSelectGame = (gameId?: string): void => {
        const library = getBrowseSubPath(this.props.location.pathname);
        const view = this.state.views[library];
        if (view) {
            this.setState({
                views: {
                    ...this.state.views,
                    [library]: {
                        ...view,
                        selectedGameId: gameId,
                    },
                },
            });
        }
    };

    /** Set the selected playlist for a single "browse route" */
    private onSelectPlaylist = (
        library: string,
        playlistId: string | undefined
    ): void => {
        const view = this.state.views[library];
        if (view) {
            this.setState({
                views: {
                    ...this.state.views,
                    [library]: {
                        ...view,
                        selectedPlaylistId: playlistId,
                        selectedGameId: undefined,
                    },
                },
            });
        }
    };

    onLaunchGame(gameId: string): void {
        window.External.back.send<LaunchGameData>(BackIn.LAUNCH_GAME, {
            id: gameId,
        });
    }

    /** Fetch the selected game of the specified library (or the first page if no game is selected). */
    requestSelectedGame(library: string): void {
        const view = this.state.views[library];

        if (!view) {
            log(
                `Failed to request game index. Current view is missing (Library: "${library}", View: "${view}").`
            );
            return;
        }

        if (view.selectedGameId === undefined) {
            this.onRequestGames(0, 1);
        } else {
            window.External.back.send<any, BrowseViewIndexData>(
                BackIn.BROWSE_VIEW_INDEX,
                {
                    gameId: view.selectedGameId,
                    query: {
                        library: library,
                        search: view.query.search,
                        playlistId: view && view.selectedPlaylistId,
                        orderBy: view.query.orderBy,
                        orderReverse: view.query.orderReverse,
                    },
                },
                (res) => {
                    const resData: BrowseViewIndexResponseData = res.data;
                    if (resData.index >= 0) {
                        // (Game found)
                        this.onRequestGames(resData.index, 1);
                    } else {
                        // (Game not found)
                        this.setState(
                            {
                                views: {
                                    ...this.state.views,
                                    [library]: {
                                        ...view,
                                        selectedGameId: undefined,
                                    },
                                },
                            },
                            () => {
                                this.onRequestGames(0, 1);
                            }
                        );
                    }
                }
            );
        }
    }

    onRequestGames = (offset: number, limit: number): void => {
        const library = getBrowseSubPath(this.props.location.pathname);
        const view = this.state.views[library];

        if (!view) {
            log(
                `Failed to request games. Current view is missing (Library: "${library}", View: "${view}").`
            );
            return;
        }

        const pageMin = Math.floor(offset / VIEW_PAGE_SIZE);
        const pageMax = Math.ceil((offset + limit) / VIEW_PAGE_SIZE);

        const pageIndices: number[] = [];
        const pages: ViewPage[] = [];
        for (let page = pageMin; page <= pageMax; page++) {
            if (view.dirtyCache || !view.pages[page]) {
                pageIndices.push(page);
                pages.push({});
            }
        }

        if (pages.length > 0) {
            window.External.back.sendReq<any, BrowseViewPageData>({
                id: library, // @TODO Add this as an optional property of the data instead of misusing the id
                type: BackIn.BROWSE_VIEW_PAGE,
                data: {
                    offset: pageMin * VIEW_PAGE_SIZE,
                    limit: (pageMax - pageMin + 1) * VIEW_PAGE_SIZE,
                    query: {
                        library: library,
                        search: view.query.search,
                        playlistId: view && view.selectedPlaylistId,
                        orderBy: view.query.orderBy,
                        orderReverse: view.query.orderReverse,
                    },
                },
            });

            const newPages: Record<number, ViewPage | undefined> = {};
            for (let i = 0; i < pages.length; i++) {
                newPages[pageIndices[i]] = pages[i];
            }
            this.setState({
                views: {
                    ...this.state.views,
                    [library]: {
                        ...view,
                        pages: {
                            ...view.pages,
                            ...newPages,
                        },
                    },
                },
            });
        }
    };

    onQuickSearch = (search: string): void => {
        const library = getBrowseSubPath(this.props.location.pathname);
        const view = this.state.views[library];
        if (!view) {
            log(
                `Failed to quick search. Current view is missing (Library: "${library}", View: "${view}").`
            );
            return;
        }
        window.External.back.send<QuickSearchResponseData, QuickSearchData>(
            BackIn.QUICK_SEARCH,
            {
                search: search,
                query: {
                    library: library,
                    search: this.props.search.text, // view.query.search,
                    playlistId: view && view.selectedPlaylistId,
                    orderBy: this.state.order.orderBy, // view.query.orderBy,
                    orderReverse: this.state.order.orderReverse, // view.query.orderReverse,
                },
            },
            (res) => {
                const view = this.state.views[library];
                if (res.data && view) {
                    // Fetch the page that the game is on
                    if (
                        res.data.index !== undefined &&
                        !view.pages[(res.data.index / VIEW_PAGE_SIZE) | 0]
                    ) {
                        this.onRequestGames(res.data.index, res.data.index);
                    }

                    this.setState({
                        views: {
                            ...this.state.views,
                            [library]: {
                                ...view,
                                selectedGameId: res.data.id,
                            },
                        },
                    });
                }
            }
        );
    };

    cachePlaylistIcons(playlists: GamePlaylist[]): void {
        Promise.all(
            playlists.map((p) =>
                (async () => {
                    if (p.icon) {
                        return cacheIcon(p.icon);
                    }
                })()
            )
        ).then((urls) => {
            const cache: Record<string, string> = {};
            for (let i = 0; i < playlists.length; i++) {
                const url = urls[i];
                if (url) {
                    cache[playlists[i].filename] = url;
                }
            }
            this.setState({ playlistIconCache: cache });
        });
    }

    orderAndFilterPlaylistsMemo = memoizeOne(
        (playlists: GamePlaylist[], currentPlatform: string) => {
            return playlists
                .filter((p) => p.library && p.library === currentPlatform)
                .sort((a, b) => {
                    if (a.title < b.title) {
                        return -1;
                    }
                    if (a.title > b.title) {
                        return 1;
                    }
                    return 0;
                });
        }
    );

    private unmountBeforeClose = (): void => {
        this.setState({ stopRender: true });
        setTimeout(() => {
            window.close();
        }, 100);
    };

    /** Convert the platforms object into a flat array of platform names (with all duplicates removed). */
    private flattenPlatformsMemo = memoizeOne(
        (platforms: Record<string, string[]>): string[] => {
            const names: string[] = [];
            const libraries = Object.keys(platforms);
            for (let i = 0; i < libraries.length; i++) {
                const p = platforms[libraries[i]];
                for (let j = 0; j < p.length; j++) {
                    if (names.indexOf(p[j]) === -1) {
                        names.push(p[j]);
                    }
                }
            }
            return names;
        }
    );
}

/** Get the "library route" of a url (returns empty string if URL is not a valid "sub-browse path") */
function getBrowseSubPath(urlPath: string): string {
    if (urlPath.startsWith(Paths.BROWSE)) {
        let str = urlPath.substring(Paths.BROWSE.length);
        if (str[0] === "/") {
            str = str.substring(1);
        }
        return str;
    }
    return "";
}

async function cacheIcon(icon: string): Promise<string> {
    const r = await fetch(icon);
    const blob = await r.blob();
    return `url(${URL.createObjectURL(blob)})`;
}

function log(content: string): void {
    window.External.back.send<any, AddLogData>(BackIn.ADD_LOG, {
        source: "Launcher",
        content: content,
    });
}
