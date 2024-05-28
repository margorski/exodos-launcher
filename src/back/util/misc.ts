import { getLaunchboxFilename } from "@back/game/LaunchBoxHelper";
import { fixSlashes } from "@shared/Util";
import { GameImagesCollection, GameVideosCollection, IGameInfo } from "@shared/game/interfaces";
import { DeepPartial } from "@shared/interfaces";
import { IFileInfo } from "@shared/platform/interfaces";
import * as fs from "fs";
import * as path from "path";

export function pathExists(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (error) => {
            if (error) {
                if (error.code === "ENOENT") {
                    resolve(false);
                } else {
                    reject(error);
                }
            } else {
                resolve(true);
            }
        });
    });
}

export type ErrorCopy = {
    columnNumber?: number;
    fileName?: string;
    lineNumber?: number;
    message: string;
    name: string;
    stack?: string;
};

/** Copy properties from an error to a new object. */
export function copyError(error: any): ErrorCopy {
    if (typeof error !== "object" || error === null) {
        error = {};
    }
    const copy: ErrorCopy = {
        message: error.message + "",
        name: error.name + "",
    };
    // @TODO These properties are not standard, and perhaps they have different types in different environments.
    //       So do some testing and add some extra checks mby?
    if (typeof error.columnNumber === "number") {
        copy.columnNumber = error.columnNumber;
    }
    if (typeof error.fileName === "string") {
        copy.fileName = error.fileName;
    }
    if (typeof error.lineNumber === "number") {
        copy.lineNumber = error.lineNumber;
    }
    if (typeof error.stack === "string") {
        copy.stack = error.stack;
    }
    return copy;
}

export function* walkSync(dir: string): IterableIterator<IFileInfo> {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkSync(path.join(dir, file.name));
        } else {
            yield {
                filename: file.name,
                path: path.join(dir, file.name),
            };
        }
    }
}

/**
 * Recursively iterate over all properties of the template object and compare the values of the same
 * properties in object A and B. All properties that are not equal will be added to the returned object.
 * Missing properties, or those with the value undefined, in B will be ignored.
 * If all property values are equal undefined is returned.
 * @param template Template object. Iteration will be done over this object.
 * @param a Compared to B.
 * @param b Compared to A. Values in the returned object is copied from this.
 */
export function difObjects<T>(
    template: T,
    a: T,
    b: DeepPartial<T>
): DeepPartial<T> | undefined {
    let dif: DeepPartial<T> | undefined;
    for (let key in template) {
        if (a[key] !== b[key] && b[key] !== undefined) {
            if (
                typeof template[key] === "object" &&
                typeof a[key] === "object" &&
                typeof b[key] === "object"
            ) {
                // Note: TypeScript doesn't understand that it is not possible for b[key] to be undefined here
                const subDif = difObjects(template[key], a[key], b[key] as any);
                if (subDif) {
                    if (!dif) {
                        dif = {};
                    }
                    dif[key] = subDif as any;
                }
            } else {
                if (!dif) {
                    dif = {};
                }
                dif[key] = b[key] as any;
            }
        }
    }
    return dif;
}

const thumbnailPreference = [
    'Box - Front',
    'Box - Front - Reconstructed',
    'Clear Logo',
    'Screenshot - Game Title',
];

export function loadGameMedia(game: IGameInfo, images: GameImagesCollection, videos: GameVideosCollection) {
    const formattedGameTitle = getLaunchboxFilename(game.title);

    // Load all images
    for (const category of Object.keys(images)) {
        if (images[category][formattedGameTitle]) {
            game.media.images[category] = images[category][formattedGameTitle];
        }
    }

    // Load videos
    try {
        const formattedGamePath = path.basename(fixSlashes(game.applicationPath)).split('.bat')[0];

        if (videos[formattedGamePath]) {
            game.media.video = `Videos/${game.platform}/${videos[formattedGamePath]}`;
        }
    } catch {
        // Ignore, files don't exist if path isn't forming
    }

    // Load thumbnail path
    for (const preference of thumbnailPreference) {
        if (images[preference] && images[preference][formattedGameTitle]) {
            game.thumbnailPath = `Images/${game.platform}/${fixSlashes(images[preference][formattedGameTitle][0])}`;
            return;
        }
    }
}
