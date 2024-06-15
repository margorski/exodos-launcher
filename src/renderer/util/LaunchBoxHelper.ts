import { IRawPlatformFile } from "@shared/platform/interfaces";

/**
 * Format the result of "fast-xml-parser" into a structured object.
 * This ensures that all types that will be used exists and is of the proper type.
 * @param data Object to format.
 */
export function formatPlatformFileData(data: any): data is IRawPlatformFile {
    if (!isObject(data)) {
        return false;
    }

    // If there are multiple "LaunchBox" elements, remove all but the first (There should never be more than one!)
    if (Array.isArray(data.LaunchBox)) {
        data.LaunchBox = data.LaunchBox[0];
    }

    if (!isObject(data.LaunchBox)) {
        data.LaunchBox = {};
    }

    data.LaunchBox.Game = convertEntitiesToArray(data.LaunchBox.Game);
    data.LaunchBox.AdditionalApplication = convertEntitiesToArray(
        data.LaunchBox.AdditionalApplication
    );

    return true;

    function isObject(obj: any): boolean {
        return typeof obj === "object" && data.LaunchBox !== null;
    }

    function convertEntitiesToArray(entries: any | any[] | undefined): any[] {
        if (Array.isArray(entries)) {
            // Multiple entries
            return entries;
        } else if (entries) {
            // One entry
            return [entries];
        } else {
            // No entries
            return [];
        }
    }
}

// Change a string to work with the Launchbox images / filename structure
export function getLaunchboxFilename(str: string): string {
    return str.replace(/[';:?]/g, '_'); // Replace some characters with underscores
}
