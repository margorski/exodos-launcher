import { app, dialog } from "@electron/remote";
import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import { setTheme } from "@shared/Theme";
import { Theme } from "@shared/ThemeFile";
import { getFileServerURL } from "@shared/Util";
import {
    AddLogData,
    BackIn,
    BackInit,
    BackOut,
    GetGamesTotalResponseData,
    GetPlaylistResponse,
    InitEventData,
    LaunchGameData,
    LocaleUpdateData,
    LogEntryAddedData,
    PlaylistRemoveData,
    ThemeChangeData,
    ThemeListChangeData
} from "@shared/back/types";
import { APP_TITLE } from "@shared/constants";
import { IGameInfo } from "@shared/game/interfaces";
import { ExodosBackendInfo, GamePlaylist, WindowIPC } from "@shared/interfaces";
import { getLibraryItemTitle } from "@shared/library/util";
import { memoizeOne } from "@shared/memoize";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import { updatePreferencesData } from "@shared/preferences/util";
import { debounce } from "@shared/utils/debounce";
import { ipcRenderer } from "electron";
import { UpdateInfo } from "electron-updater";
import * as React from "react";
import { ConnectedProps, connect } from "react-redux";
import { Paths } from "./Paths";
import { GameOrderChangeEvent } from "./components/GameOrder";
import { SplashScreen } from "./components/SplashScreen";
import { TitleBar } from "./components/TitleBar";
import { ConnectedFooter } from "./containers/ConnectedFooter";
import HeaderContainer from "./containers/HeaderContainer";
import { WithPreferencesProps, withPreferences } from "./containers/withPreferences";
import { WithRouterProps, withRouter } from "./containers/withRouter";
import { GamesInitState, initialize } from "./redux/gamesSlice";
import { initializeViews } from "./redux/searchSlice";
import { RootState } from "./redux/store";
import { AppRouter, AppRouterProps } from "./router";
// Auto updater works only with .appImage distribution. We are using .tar.gz
// so it will just fail silently. Code is left for future.

const VIEW_PAGE_SIZE = 250;

type Views = Record<string, View | undefined>; // views[id] = view
type View = {
    games: Array<IGameInfo>;
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

const mapState = (state: RootState) => ({
    searchState: state.searchState,
    totalGames: state.gamesState.totalGames,
    gamesLoaded: state.gamesState.initState,
    libraries: state.gamesState.libraries,
});

const mapDispatch = {
    initializeGames: initialize,
    initializeViews: initializeViews
}

const connector = connect(mapState, mapDispatch);

type OwnProps = {};

export type AppProps = ConnectedProps<typeof connector> & OwnProps & WithRouterProps & WithPreferencesProps;

export type AppState = {
    playlists: GamePlaylist[];
    playlistIconCache: Record<string, string>; // [PLAYLIST_ID] = ICON_BLOB_URL
    appPaths: Record<string, string>;
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
    /** Key to force refresh of current game */
    currentGameRefreshKey: number;
};

class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);

        const preferencesData = this.props.preferencesData;
        const order: GameOrderChangeEvent = {
            orderBy: preferencesData.gamesOrderBy,
            orderReverse: preferencesData.gamesOrder,
        };

        // Set initial state
        this.state = {
            playlists: window.External.initialPlaylists || [],
            playlistIconCache: {},
            appPaths: {},
            loaded: {
                0: false,
                1: false,
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
            currentGameRefreshKey: 0,
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

        this.props.initializeGames();

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
                case BackOut.GAME_CHANGE:
                    {
                        // We don't track selected game here, so we'll just force a game update anyway
                        this.setState({ currentGameRefreshKey: this.state.currentGameRefreshKey + 1 });
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

        // Check if theme changed
        if (
            preferencesData.currentTheme !==
            prevProps.preferencesData.currentTheme
        ) {
            setTheme(preferencesData.currentTheme);
        }

        // Update preference "lastSelectedLibrary"
        const gameLibrary = getBrowseSubPath(location.pathname);
        if (
            location.pathname.startsWith(Paths.BROWSE) &&
            preferencesData.lastSelectedLibrary !== gameLibrary
        ) {
            updatePreferencesData({ lastSelectedLibrary: gameLibrary });
        }

        // // Create a new game
        // if (this.state.wasNewGameClicked) {
        //     let route = "";
        //     if (preferencesData.lastSelectedLibrary) {
        //         route = preferencesData.lastSelectedLibrary;
        //     } else {
        //         const defaultLibrary = preferencesData.defaultLibrary;
        //         if (defaultLibrary) {
        //             route = defaultLibrary;
        //         } else {
        //             route = UNKNOWN_LIBRARY;
        //         }
        //     }

        //     if (location.pathname.startsWith(Paths.BROWSE)) {
        //         this.setState({ wasNewGameClicked: false });
        //         // Deselect the current game
        //         const view = this.state.views[route];
        //         if (view && view.selectedGameId !== undefined) {
        //             const views = { ...this.state.views };
        //             views[route] = {
        //                 ...view,
        //                 selectedGameId: undefined,
        //             };
        //             this.setState({ views });
        //         }
        //     } else {
        //         navigate(joinLibraryRoute(route));
        //     }
        // }
    }

    render() {
        const loaded =
            this.props.gamesLoaded === GamesInitState.LOADED &&
            this.state.loaded[BackInit.PLAYLISTS] &&
            this.state.loaded[BackInit.EXEC];
        const libraryPath = getBrowseSubPath(this.props.location.pathname);
        const view = this.props.searchState.views[libraryPath];
        const playlists = this.orderAndFilterPlaylistsMemo(this.state.playlists);

        // Props to set to the router
        const routerProps: AppRouterProps = {
            gamesTotal: view ? view.games.length : 0,
            playlists: playlists,
            appPaths: this.state.appPaths,
            playlistIconCache: this.state.playlistIconCache,
            onLaunchGame: this.onLaunchGame,
            libraries: this.props.libraries,
            localeCode: this.state.localeCode,
            order: this.state.order,
            gameScale: this.state.gameScale,
            gameLayout: this.state.gameLayout,
            wasNewGameClicked: this.state.wasNewGameClicked,
            gameLibrary: libraryPath,
            themeList: this.state.themeList,
            updateInfo: this.state.updateInfo,
            exodosBackendInfo: this.state.exodosBackendInfo,
            currentGameRefreshKey: this.state.currentGameRefreshKey,
        };
        // Render
        return (
            <>
                {!this.state.stopRender ? (
                    <>
                        {/* Splash screen */}
                        <SplashScreen
                            gamesLoaded={this.props.gamesLoaded === GamesInitState.LOADED}
                            playlistsLoaded={this.state.loaded[BackInit.PLAYLISTS]}
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
                                    libraries={this.props.libraries}
                                    onToggleLeftSidebarClick={
                                        this.onToggleLeftSidebarClick
                                    }
                                    onToggleRightSidebarClick={
                                        this.onToggleRightSidebarClick
                                    }
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
                                    totalCount={this.props.totalGames}
                                    currentLabel={
                                        libraryPath &&
                                        getLibraryItemTitle(libraryPath)
                                    }
                                    currentCount={view ? view.games.length : 0}
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

    // private onOrderChange = (event: GameOrderChangeEvent): void => {
    //     const library = getBrowseSubPath(this.props.location.pathname);
    //     const view = this.state.views[library];
    //     if (view) {
    //         // @TODO I'm thinking about moving the order options to be specific to each view,
    //         //       instead of global. But maybe that is unnecessary and just adds complexity.
    //         this.setState(
    //             {
    //                 order: event,
    //                 views: {
    //                     ...this.state.views,
    //                     [library]: {
    //                         ...view,
    //                         dirtyCache: true,
    //                         query: {
    //                             ...view.query,
    //                             orderBy: event.orderBy,
    //                             orderReverse: event.orderReverse,
    //                         },
    //                     },
    //                 },
    //             },
    //             () => {
    //                 this.requestSelectedGame(library);
    //             }
    //         );
    //     }
    //     // Update Preferences Data (this is to make it get saved on disk)
    //     updatePreferencesData({
    //         gamesOrderBy: event.orderBy,
    //         gamesOrder: event.orderReverse,
    //     });
    // };

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

    onLaunchGame(gameId: string): void {
        window.External.back.send<LaunchGameData>(BackIn.LAUNCH_GAME, {
            id: gameId,
        });
    }

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
        (playlists: GamePlaylist[]) => {
            return playlists
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

export default withRouter(withPreferences(connector(App)));

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
