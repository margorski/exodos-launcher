import { IAppConfigData } from "@shared/config/interfaces";
import { deepCopy, parseVarStr, fixSlashes } from "@shared/Util";
import { Coerce } from "@shared/utils/Coerce";
import { ObjectParser } from "@shared/utils/ObjectParser";

const { num, str } = Coerce;

type IConfigDataDefaults = {
    [key: string]: Readonly<IAppConfigData>;
};

/** Default config values used as a "base" for the different platform defaults. */
const configDataDefaultBase: Readonly<IAppConfigData> = Object.freeze({
    exodosPath: "../",
    imageFolderPath: "Images",
    logoFolderPath: "Data/Logos",
    playlistFolderPath: "Data/Playlists",
    jsonFolderPath: "Data",
    platformFolderPath: "Data/Platforms",
    themeFolderPath: "Data/Themes",
    useCustomTitlebar: false,
    backPortMin: 12001,
    backPortMax: 12100,
    imagesPortMin: 12101,
    imagesPortMax: 12200,
    nativePlatforms: [],
});

/**
 * Default config values for the different platforms.
 * All platforms not listed here use will use the base.
 */
const configDataDefaults: IConfigDataDefaults = {
    // Windows
    win32: Object.freeze(
        overwriteConfigData(deepCopy(configDataDefaultBase), {
            useCustomTitlebar: true,
        })
    ),
    // Linux
    linux: Object.freeze(
        overwriteConfigData(deepCopy(configDataDefaultBase), {
            useCustomTitlebar: false,
        })
    ),
    // ...
};

/**
 * Get the default config data for a specific platform.
 * @param platform Platform to get the defaults for.
 */
export function getDefaultConfigData(
    platform: NodeJS.Platform
): IAppConfigData {
    return configDataDefaults[platform] || configDataDefaultBase;
}

/**
 * Overwrite a config data object with data from another object.
 * @param source Object to overwrite.
 * @param data Object with data to overwrite the source with.
 * @returns Source argument (not a copy).
 */
export function overwriteConfigData(
    source: IAppConfigData,
    data: Partial<IAppConfigData>,
    onError?: (error: string) => void
): IAppConfigData {
    const parser = new ObjectParser({
        input: data,
        onError:
            onError &&
            ((e) => onError(`Error while parsing Config: ${e.toString()}`)),
    });
    parser.prop("exodosPath", (v) => (source.exodosPath = parseVarStr(str(v))));
    parser.prop(
        "imageFolderPath",
        (v) => (source.imageFolderPath = parseVarStr(str(v)))
    );
    parser.prop(
        "logoFolderPath",
        (v) => (source.logoFolderPath = parseVarStr(str(v)))
    );
    parser.prop(
        "playlistFolderPath",
        (v) => (source.playlistFolderPath = parseVarStr(str(v)))
    );
    parser.prop(
        "jsonFolderPath",
        (v) => (source.jsonFolderPath = parseVarStr(str(v)))
    );
    parser.prop(
        "platformFolderPath",
        (v) => (source.platformFolderPath = parseVarStr(str(v)))
    );
    parser.prop(
        "themeFolderPath",
        (v) => (source.themeFolderPath = parseVarStr(str(v)))
    );
    parser.prop("useCustomTitlebar", (v) => (source.useCustomTitlebar = !!v));
    parser.prop(
        "nativePlatforms",
        (v) => (source.nativePlatforms = strArray(v))
    );
    parser.prop("backPortMin", (v) => (source.backPortMin = num(v)));
    parser.prop("backPortMax", (v) => (source.backPortMax = num(v)));
    parser.prop("imagesPortMin", (v) => (source.imagesPortMin = num(v)));
    parser.prop("imagesPortMax", (v) => (source.imagesPortMax = num(v)));
    // Do some alterations
    source.exodosPath = fixSlashes(source.exodosPath); // (Clean path)
    // Return
    return source;
}

function strArray(array: any): string[] {
    return Array.isArray(array)
        ? (Array.prototype.map.call(array, (v) => str(v)) as string[])
        : [];
}
