import { OpenDialogOptions } from "electron";
import { SharedSocket } from "./back/SharedSocket";
import { IAppConfigData } from "./config/interfaces";
import { ILogEntry } from "./Log/interface";
import { IAppPreferencesData } from "./preferences/interfaces";
import { Theme } from "./ThemeFile";

/** Recursively set all properties as optional. */
export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Subtract the properties of U from T. */
export type Subtract<T, U extends object> = Pick<T, Exclude<keyof T, keyof U>>;

export interface IMainWindowExternal {
    /** If the launcher is installed (instead of being portable). */
    installed: boolean;

    /** Version of the current launcher build. */
    version: number;

    /** The type of OS this is running on. */
    platform: NodeJS.Platform;

    /** Minimize the window */
    minimize(): void;

    /** Maximize the window (or un-maximize if already maximized) */
    maximize(): void;

    /** Close the window */
    close(): void;

    /** Restart the application (closes all windows) */
    restart(): void;

    /** Wrapper for Electron's function with the same name. */
    showOpenDialogSync(options: OpenDialogOptions): string[] | undefined;

    /** Open/Close the DevTools for this window */
    toggleDevtools(): void;

    preferences: {
        /** Current preferences. */
        data: IAppPreferencesData;
        /** Emitter for preference related events. */
        onUpdate?: () => void;
    };

    /** Renderers interface for the Config data */
    config: {
        data: IAppConfigData;
        /** Full path of the Exodos folder. */
        fullExodosPath: string;
        /** Full path of the JSON folder. */
        fullJsonFolderPath: string;
    };

    /** Log entries fetched from the back process. */
    log: {
        entries: ILogEntry[];
        offset: number;
    };

    /** If the launcher is running in development mode (using something like "npm run start"). */
    isDev: boolean;

    /** If the "back" is running remotely. */
    isBackRemote: boolean;

    /** Socket to the back API. */
    back: SharedSocket<WebSocket>;

    /** Port of the back file server. */
    fileServerPort: number;

    /** URL of the back websocket server. */
    backUrl: URL;

    initialThemes: Theme[];
    initialPlaylists?: GamePlaylist[];
    initialLocaleCode: string;

    /**
     * Wait for the preload to initialize.
     * @returns A promise that resolves when initialization is complete, or nothing if already initialized.
     */
    waitUntilInitialized(): Promise<void> | void;
}

/** Callback for Electron.dialog.showOpenDialog */
export type ElectronOpenDialogCallback = (
    filePaths?: string[],
    bookmarks?: string[]
) => void;

/** Obtain the return type of a function */
export type ReturnTypeOf<T extends AnyFunction> = T extends (
    ...args: ArgumentTypesOf<T>
) => infer R
    ? R
    : any;

/** Obtain the argument types of a function */
export type ArgumentTypesOf<F extends AnyFunction> = F extends (
    ...args: infer A
) => any
    ? A
    : never;

/** Any function. */
export type AnyFunction = (...args: any[]) => any;

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export interface IObjectMap<T> {
    [key: string]: T | undefined;
}

/** Make all properties optional recursively. */
export type RecursivePartial<T> = {
    [key in keyof T]?: RecursivePartial<T[key]>;
};

/** From T, pick a set of properties whose values are assignable to U. */
export type PickType<T, U> = {
    [P in keyof T]: T[P] extends U ? P : never;
}[keyof T];

/** IPC channels used to relay window events from main to renderer. */
export enum WindowIPC {
    /** Sent whenever the windows "maximize" status changes. (main -> renderer). */
    WINDOW_MAXIMIZE = "window-maximize",
    /** Sent whenever the windows position changes. (main -> renderer). */
    WINDOW_MOVE = "window-move",
    /** Sent whenever the windows size changes. (main -> renderer). */
    WINDOW_RESIZE = "window-resize",
}

/** IPC channels used to relay game manager events from  */

export type IBackProcessInfo = {
    /** Path of the file (relative to the Exodos root) */
    path: string;
    /** Name of the file to execute */
    filename: string;
    /** Arguments to pass to the process */
    arguments: string[];
    /**
     * If the process should be "killed" when shutting down
     * (This does not do anything for "start" and "stop" processes)
     */
    kill: boolean;
};

export type GamePlaylist = GamePlaylistContent & {
    /** Filename of the playlist (unique for each playlist). */
    filename: string;
};

/** Data contained inside a Playlist file. */
export type GamePlaylistContent = {
    /** Game entries in the playlist. */
    games: GamePlaylistEntry[];
    /** Title of the playlist. */
    title: string;
    /** Description of the playlist. */
    description: string;
    /** Author of the playlist. */
    author: string;
    /** Icon of the playlist (Base64 encoded image). */
    icon?: string;
    /** Dynamic filter */
    filter?: GameFilter;
};

/** An entry inside a Playlist file. */
export type GamePlaylistEntry = {
    id: string;
    title: string;
    platform: string;
};

export type ExecMapping = {
    /** Windows path */
    win32: string;
    /** Linux path (if exists) */
    linux?: string;
    /** Mac path (if exists) */
    darwin?: string;
};

export type ExodosBackendInfo = {
    changelog: string;
    version: string;
};

export interface FieldFilter {
    generic: Array<string>,
    id: Array<string>
    title: Array<string>,
    series: Array<string>,
    developer: Array<string>,
    publisher: Array<string>,
    platform: Array<string>,
    genre: Array<string>,
    releaseDate: Array<string>,
}

export type GameFilter = {
    subfilters: Array<GameFilter>,
    whitelist: FieldFilter,
    blacklist: FieldFilter,
    exactWhitelist: FieldFilter,
    exactBlacklist: FieldFilter,
    matchAny: boolean,
}

export type GameSearch = {
    filter: GameFilter,
    order: GameSearchOrder,
}

export enum GameSearchDirection {
    ASC,
    DESC,
}

export type GameSearchSortable = "title"
    | "dateAdded"
    | "genre"
    | "platform"
    | "series"
    | "developer"
    | "publisher"
    | "releaseDate";

export type GameSearchOrder = {
    column: GameSearchSortable,
    direction: GameSearchDirection,
}