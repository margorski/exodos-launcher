import { MessageBoxOptions, OpenExternalOptions } from "electron";
import { IAppConfigData } from "../config/interfaces";
import { IAdditionalApplicationInfo, IGameInfo } from "../game/interfaces";
import { GamePlaylist, ExecMapping } from "../interfaces";
import { ILogEntry, ILogPreEntry } from "../Log/interface";
import { IAppPreferencesData } from "../preferences/interfaces";
import { Theme } from "../ThemeFile";

export enum BackIn {
    GENERIC_RESPONSE,
    INIT_LISTEN,
    GET_GAMES_TOTAL,
    SET_LOCALE,
    GET_EXEC,
    SAVE_GAME,
    GET_GAME,
    GET_ALL_GAMES,
    RANDOM_GAMES,
    LAUNCH_GAME,
    LAUNCH_GAME_SETUP,
    LAUNCH_ADDAPP,
    QUICK_SEARCH,
    ADD_LOG,
    GET_PLAYLISTS,
    LAUNCH_COMMAND,
    QUIT,
    /** Get a page of a browse view. */
    BROWSE_VIEW_PAGE,
    BROWSE_VIEW_INDEX,
    /** Get all data needed on init (by the renderer). */
    GET_RENDERER_INIT_DATA,
    /** Get all data needed on init (by the renderer). */
    GET_MAIN_INIT_DATA,
    /** Update any number of configs. */
    UPDATE_CONFIG,
    /** Update any number of preferences. */
    UPDATE_PREFERENCES,
}

export enum BackOut {
    GENERIC_RESPONSE,
    INIT_EVENT,
    OPEN_DIALOG,
    OPEN_EXTERNAL,
    LOCALE_UPDATE,
    BROWSE_VIEW_PAGE_RESPONSE,
    GET_MAIN_INIT_DATA,
    UPDATE_PREFERENCES_RESPONSE,
    BROWSE_CHANGE,
    IMAGE_CHANGE,
    LOG_ENTRY_ADDED,
    THEME_CHANGE,
    THEME_LIST_CHANGE,
    PLAYLIST_UPDATE,
    PLAYLIST_REMOVE,
    QUIT,
}

export type WrappedRequest<T = any> = {
    /** Identifier of the response */
    id: string;
    /** Type of the request */
    type: BackIn;
    /** Data contained in the response (if any) */
    data?: T;
};

export type WrappedResponse<T = any> = {
    /** Identifier of the response */
    id: string;
    /** Type of the response */
    type: BackOut;
    /** Data contained in the response (if any) */
    data?: T;
};

export type BackInitArgs = {
    /** Path to the folder containing the preferences and config files. */
    configFolder: string;
    /** Secret string used for authentication. */
    secret: string;
    isDev: boolean;
    localeCode: string;
    exePath: string;
    /** If the back should accept remote clients to connect (renderers from different machines). */
    acceptRemote: boolean;
};

export enum BackInit {
    GAMES,
    PLAYLISTS,
    EXEC,
}

export type AddLogData = ILogPreEntry;

export type InitEventData = {
    done: BackInit[];
};

export type GetMainInitDataResponse = {
    config: IAppConfigData;
    preferences: IAppPreferencesData;
};

export type GetRendererInitDataResponse = {
    config: IAppConfigData;
    preferences: IAppPreferencesData;
    fileServerPort: number;
    log: ILogEntry[];
    themes: Theme[];
    playlists?: GamePlaylist[];
    platforms: Record<string, string[]>;
    localeCode: string;
};

export type GetGamesTotalResponseData = number;

export type SetLocaleData = string;

export type LocaleUpdateData = string;

export type GetExecData = ExecMapping[];

export type OpenDialogData = MessageBoxOptions;

export type OpenDialogResponseData = number;

export type OpenExternalData = {
    url: string;
    options?: OpenExternalOptions;
};

export type OpenExternalResponseData = {
    error?: Error;
};

export type LaunchGameData = {
    id: string;
};

export type GetGameData = {
    id: string;
};

export type GetGameResponseData = {
    game?: IGameInfo;
    addApps?: IAdditionalApplicationInfo[];
};

export type GetAllGamesResponseData = {
    games: IGameInfo[];
};

export type RandomGamesData = {
    count: number;
    broken: boolean;
    extreme: boolean;
};

export type RandomGamesResponseData = IGameInfo[];

export type LaunchAddAppData = {
    id: string;
};

export type LaunchExodosContentData = {
    path: string;
};

export type BrowseViewAllData = {
    libraries: string[];
};

export type BrowseViewUpdateData = {
    viewId?: string;
    query: unknown;
};

export type BrowseViewResponseData = {
    viewId: string;
    total: number;
};

export type BrowseViewPageData = {
    offset: number;
    limit: number;
    query: GameQuery;
};

export type BrowseViewPageResponseData = {
    games: ViewGame[];
    offset: number;
    total?: number;
};

export type BrowseViewIndexData = {
    gameId: string;
    query: GameQuery;
};

export type BrowseViewIndexResponseData = {
    index: number;
};

export type QuickSearchData = {
    query: GameQuery;
    search: string;
};

export type QuickSearchResponseData = {
    id?: string;
    index?: number;
};

type GameQuery = {
    extreme: boolean;
    broken: boolean;
    library: string;
    search: string;
    playlistId?: string;
    orderBy: string;
    orderReverse: string;
};

export type UpdateConfigData = Partial<IAppConfigData>;

export type ViewGame = {
    id: string;
    title: string;
    convertedTitle: string;
    platform: string;
    // List view only
    genre: string;
    developer: string;
    publisher: string;
    releaseDate: string;
    thumbnailPath: string;
};

export type BrowseChangeData = {
    library?: string;
    gamesTotal: number;
};

export type ImageChangeData = {
    folder: string;
    id: string;
};

export type LogEntryAddedData = {
    entry: ILogEntry;
    index: number;
};

export type ThemeChangeData = string;

export type ThemeListChangeData = Theme[];

export type PlaylistUpdateData = GamePlaylist;

export type PlaylistRemoveData = string;

export type GetPlaylistResponse = GamePlaylist[];
