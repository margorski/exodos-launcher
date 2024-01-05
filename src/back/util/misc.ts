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
