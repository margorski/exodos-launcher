import { IAppCommandsMappingData, ICommandMapping } from "./interfaces";
import { escapeShell } from "../Util";
import path = require("path");

const FOOBAR_EXECUTABLE = "foobar2000.exe";

export const getAllowedExtensionsForMappings = (
    mappings: IAppCommandsMappingData
) => {
    const extensions = mappings.commandsMapping.reduce(
        (extensions, mapping) => {
            extensions.push(...mapping.extensions);
            return extensions;
        },
        [] as string[]
    );

    return new Set(extensions.map((e) => e.toLowerCase()));
};

function windowsSlashes(str: string) {
    return str.replace(/\//g, '\\');
}

export type Command = {
    command: string;
    cwd?: string;
}

export const createCommand = (
    filename: string,
    args: string,
    mappings: IAppCommandsMappingData
): Command => {
    let escFilename: string = process.platform !== 'win32' ? escapeShell(filename) : windowsSlashes(filename);
    let escArgs: string = escapeArgsForShell(args).join(' ');

    if (process.platform === 'win32') {
        const filedir = path.dirname(escFilename);
        return {
            cwd: filedir,
            command: `start "" "${escFilename}" ${escArgs}`
        }
    }

    const isSoundtrack = filename
        .toLocaleLowerCase()
        .endsWith(FOOBAR_EXECUTABLE);
    if (isSoundtrack) return createSoundtrackCommand(escFilename, args);

    const { command, includeArgs, includeFilename } = getCommandMapping(
        filename,
        mappings
    );
    return {
        command: `${command} ${includeFilename ? escFilename : ""} ${includeArgs ? escArgs : ""}`.trim()
    }
};

const createSoundtrackCommand = (escFilename: string, args: string): Command => {
    const foobarDirectory = escFilename.slice(0, -FOOBAR_EXECUTABLE.length);
    return {
        cwd: foobarDirectory,
        command: `flatpak run com.retro_exo.wine ${FOOBAR_EXECUTABLE} ${args}`
    }
};

const getCommandMapping = (
    filename: string,
    mappings: IAppCommandsMappingData
) => {
    const extension = filename.split(".").pop();
    if (!extension) throw "Invalid file without extension.";

    const transformer = mappings.commandsMapping.find((t) =>
        t.extensions
            .map((e) => e.toLowerCase())
            .includes(extension.toLowerCase())
    );
    return transformer ?? mappings.defaultMapping;
};

/**
 * Escapes Arguments for the operating system (Used when running a process in a shell)
 *
 * @param gameArgs Argument(s) to escape
 */
export function escapeArgsForShell(gameArgs: string | string[]): string[] {
    if (typeof gameArgs === 'string') {
      switch (process.platform) {
        case 'win32':
          return [`${escapeWin(gameArgs)}`];
        case 'darwin':
        case 'linux':
          return [`${escapeLinuxArgs(gameArgs)}`];
        default:
          throw Error('Unsupported platform');
      }
    } else {
      switch (process.platform) {
        case 'win32':
          return gameArgs.map(a => `${escapeWin(a)}`);
        case 'darwin':
        case 'linux':
          return gameArgs.map(a => `${escapeLinuxArgs(a)}`);
        default:
          throw Error('Unsupported platform');
      }
    }
  }
  
  /**
   * Escape a string that will be used in a Windows shell (command line)
   * ( According to this: http://www.robvanderwoude.com/escapechars.php )
   *
   * @param str String to escape
   */
  function escapeWin(str: string): string {
    return (
      splitQuotes(str)
      .reduce((acc, val, i) => acc + ((i % 2 === 0)
        ? val.replace(/[\^&<>|]/g, '^$&')
        : `"${val}"`
      ), '')
    );
  }
  
  /**
   * Escape arguments that will be used in a Linux shell (command line)
   * ( According to this: https://stackoverflow.com/questions/15783701/which-characters-need-to-be-escaped-when-using-bash )
   *
   * @param str String to escape
   */
  function escapeLinuxArgs(str: string): string {
    // Characters to always escape:
    const escapeChars: string[] = ['~','`','#','$','&','*','(',')','\\\\','|','[','\\]','{','}',';','<','>','?','!'];
    const match = str.match(/'/gi);
    if (match == null || match.join('').length % 2 == 0) {
      escapeChars.unshift('[');
      escapeChars.push(']');
    } else { // If there's an odd number of single quotes, escape those too.
      escapeChars.unshift('[');
      escapeChars.push('\'');
      escapeChars.push(']');
    }
    return (
      splitQuotes(str)
      .reduce((acc, val, i) => acc + ((i % 2 === 0)
        ? val.replace(new RegExp(escapeChars.join(''), 'g'), '\\$&')
        : '"' + val.replace(/[$!\\]/g, '\\$&') + '"'
      ), '')
    );
  }
  
  /**
   * Split a string to separate the characters wrapped in quotes from all other.
   * Example: '-a -b="123" "example.com"' => ['-a -b=', '123', ' ', 'example.com']
   *
   * @param str String to split.
   * @returns Split of the argument string.
   *          Items with odd indices are wrapped in quotes.
   *          Items with even indices are NOT wrapped in quotes.
   */
  function splitQuotes(str: string): string[] {
    // Search for all pairs of quotes and split the string accordingly
    const splits: string[] = [];
    let start = 0;
    while (true) {
      const begin = str.indexOf('"', start);
      if (begin >= 0) {
        const end = str.indexOf('"', begin + 1);
        if (end >= 0) {
          splits.push(str.substring(start, begin));
          splits.push(str.substring(begin + 1, end));
          start = end + 1;
        } else { break; }
      } else { break; }
    }
    // Push remaining characters
    if (start < str.length) {
      splits.push(str.substring(start, str.length));
    }
    return splits;
  }