import * as fs from "fs";
import {
    IRawAdditionalApplicationInfo,
    IRawGameInfo,
    IRawPlatformFile,
} from "../platform/interfaces";
import {
    IAdditionalApplicationInfo,
    IGameCollection,
    IGameInfo,
} from "./interfaces";
import { v4 as uuid } from "uuid";
import * as path from 'path';
import { fixSlashes } from "@shared/Util";

export class GameParser {
    public static parse(
        data: IRawPlatformFile,
        filename: string,
        exodosPath: string,
    ): IGameCollection {
        const collection: IGameCollection = {
            games: [],
            additionalApplications: [],
        };
        let apps = data.LaunchBox.AdditionalApplication;
        if (apps) {
            if (!Array.isArray(apps)) {
                apps = [apps];
            }
            for (let i = apps.length - 1; i >= 0; i--) {
                collection.additionalApplications[i] =
                    GameParser.parseRawAdditionalApplication(apps[i]);
            }
        }

        let games = data.LaunchBox.Game;
        if (games) {
            if (!Array.isArray(games)) {
                games = [games];
            }
            for (let i = games.length - 1; i >= 0; i--) {
                collection.games[i] = GameParser.parseRawGame(
                    games[i],
                    filename,
                    exodosPath,
                );
                if (games[i].ManualPath) {
                    collection.additionalApplications.push({
                        id: uuid(),
                        applicationPath: games[i].ManualPath || "",
                        autoRunBefore: false,
                        gameId: games[i].ID,
                        launchCommand: "",
                        name: "Manual",
                        waitForExit: false,
                    });
                }
            }
        }
        return collection;
    }

    private static convertTheInTitle(title: string): string {
        if (title.toLowerCase().startsWith("the ")) {
            return title.replace(/the /gi, "").concat(", The");
        }
        return title;
    }

    public static parseRawGame(
        data: Partial<IRawGameInfo>,
        library: string,
        exodosPath: string,
    ): IGameInfo {
        const title = data.Title
            ? this.convertTheInTitle(data.Title.toString())
            : "";
        const game: IGameInfo = {
            id: unescapeHTML(data.ID),
            title: unescapeHTML(data.Title),
            convertedTitle: unescapeHTML(title),
            alternateTitles: unescapeHTML(data.AlternateTitles),
            series: unescapeHTML(data.Series),
            developer: unescapeHTML(data.Developer),
            publisher: unescapeHTML(data.Publisher),
            platform: unescapeHTML(data.Platform),
            dateAdded: unescapeHTML(data.DateAdded),
            playMode: unescapeHTML(data.PlayMode),
            status: unescapeHTML(data.Status),
            notes: unescapeHTML(data.Notes),
            genre: unescapeHTML(data.Genre),
            source: unescapeHTML(data.Source),
            applicationPath: unescapeHTML(data.ApplicationPath),
            rootFolder: unescapeHTML(data.RootFolder),
            launchCommand: unescapeHTML(data.CommandLine),
            releaseDate: unescapeHTML(data.ReleaseDate),
            version: unescapeHTML(data.Version),
            originalDescription: unescapeHTML(data.OriginalDescription),
            language: unescapeHTML(data.Language),
            library: library,
            orderTitle: generateGameOrderTitle(title),
            placeholder: false, // (No loaded game is a placeholder),
            manualPath: unescapeHTML(data.ManualPath),
            musicPath: unescapeHTML(data.MusicPath),
            configurationPath: unescapeHTML(data.ConfigurationPath),
            recommended: data.Favorite ?? false,
            favorite: false,
            maxPlayers: data.MaxPlayers,
            rating: unescapeHTML(data.Rating),
            region: unescapeHTML(data.Region),
            thumbnailPath: "",
            installed: false,
            media: {
                images: {},
                video: "",
            },
        };

        /**
         * XML application path refers to a different folder, but we can predict the real name based on the final segment
         * 
         * e.g
         * gamesPath: eXo/eXoDOS/1Ton
         * xml root: eXo/eXoDOS/!dos/1Ton
         * Capture dirname `1Ton` and compare that instead
         *  */
        const parts = fixSlashes(game.rootFolder).split('/');
        parts.splice(parts.length - 2, 1);
        const gameDataPath = path.join(exodosPath, parts.join('/'));
        game.installed = fs.existsSync(gameDataPath);
        return game;
    }

    private static parseRawAdditionalApplication(
        data: IRawAdditionalApplicationInfo
    ): IAdditionalApplicationInfo {
        return {
            id: unescapeHTML(data.Id),
            gameId: unescapeHTML(data.GameID),
            applicationPath: unescapeHTML(data.ApplicationPath),
            autoRunBefore: !!data.AutoRunBefore,
            launchCommand: unescapeHTML(data.CommandLine),
            name: unescapeHTML(data.Name),
            waitForExit: !!data.WaitForExit,
        };
    }

    public static reverseParseAdditionalApplication(
        addapp: IAdditionalApplicationInfo
    ): IRawAdditionalApplicationInfo {
        return {
            Id: escapeHTML(addapp.id),
            GameID: escapeHTML(addapp.gameId),
            ApplicationPath: escapeHTML(addapp.applicationPath),
            AutoRunBefore: !!addapp.autoRunBefore,
            CommandLine: escapeHTML(addapp.launchCommand),
            Name: escapeHTML(addapp.name),
            WaitForExit: !!addapp.waitForExit,
        };
    }

    public static readonly emptyRawAdditionalApplication: IRawAdditionalApplicationInfo =
        {
            Id: "",
            GameID: "",
            ApplicationPath: "",
            AutoRunBefore: false,
            CommandLine: "",
            Name: "",
            WaitForExit: false,
        };

    /**
     * Split a field value from a game into an array.
     * Some field values store multiple values, each value separated by a semicolon.
     * @param value Value to split.
     */
    public static splitFieldValue(value: string): string[] {
        return value.split(/\s?;\s?/);
    }

    /**
     * Join multiple values into a single field value.
     * Some field values store multiple values, each value separated by a semicolon.
     * @param value Value to join.
     */
    public static joinFieldValue(value: string[]): string {
        return value.join("; ");
    }
}

/** Generate a title suitable for ordering (only used for ordering and sorting, not visual) */
export function generateGameOrderTitle(title: string): string {
    return title.toLowerCase();
}

// Escape / Unescape some HTML characters
// ( From: https://stackoverflow.com/questions/18749591/encode-html-entities-in-javascript/39243641#39243641 )
// spell-checker: disable
export const unescapeHTML = (function () {
    const htmlEntities: any = Object.freeze({
        nbsp: " ",
        cent: "¢",
        pound: "£",
        yen: "¥",
        euro: "€",
        copy: "©",
        reg: "®",
        lt: "<",
        gt: ">",
        quot: '"',
        amp: "&",
        apos: "'",
    });
    return function (str?: string): string {
        return ((str || "") + "").replace(
            /&([^;]+);/g,
            function (entity: string, entityCode: string): string {
                let match;
                if (entityCode in htmlEntities) {
                    return htmlEntities[entityCode];
                } else if ((match = entityCode.match(/^#x([\da-fA-F]+)$/))) {
                    // eslint-disable-line no-cond-assign
                    return String.fromCharCode(parseInt(match[1], 16));
                } else if ((match = entityCode.match(/^#(\d+)$/))) {
                    // eslint-disable-line no-cond-assign
                    return String.fromCharCode(~~match[1]);
                } else {
                    return entity;
                }
            }
        );
    };
})();
const escapeHTML = (function () {
    const escapeChars = {
        "¢": "cent",
        "£": "pound",
        "¥": "yen",
        "€": "euro",
        "©": "copy",
        "®": "reg",
        "<": "lt",
        ">": "gt",
        '"': "quot",
        "&": "amp",
        "'": "#39",
    };
    let regexString = "[";
    for (let key in escapeChars) {
        regexString += key;
    }
    regexString += "]";
    const regex = new RegExp(regexString, "g");
    return function escapeHTML(str: string): string {
        return str.replace(regex, function (m) {
            return "&" + (escapeChars as any)[m] + ";";
        });
    };
})();

export function parse(data: IRawPlatformFile, name: any, exodosPath: any): any {
  throw new Error('Function not implemented.');
}
