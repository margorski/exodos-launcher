import { FieldFilter, GameFilter } from "@shared/interfaces";

enum KeyChar {
  MATCHES = ':',
  EQUALS = '=',
};

const KEY_CHARS = [
  "=",
  ":",
];

const REPLACEMENT = "awgdty7awgvbduiawdjnujioawd888";

export function getDefaultFieldFilter(): FieldFilter {
  return {
    generic: [],
    id: [],
    title: [],
    series: [],
    developer: [],
    publisher: [],
    platform: [],
    genre: []
  };
}

export function getDefaultGameFilter(): GameFilter {
  return {
    subfilters: [],
    whitelist: getDefaultFieldFilter(),
    blacklist: getDefaultFieldFilter(),
    exactWhitelist: getDefaultFieldFilter(),
    exactBlacklist: getDefaultFieldFilter(),
    matchAny: false
  };
}

export function parseUserInput(input: string) {
  const filter: GameFilter = {
    subfilters: [],
    whitelist: getDefaultFieldFilter(),
    blacklist: getDefaultFieldFilter(),
    exactWhitelist: getDefaultFieldFilter(),
    exactBlacklist: getDefaultFieldFilter(),
    matchAny: false
  };

  let capturingQuotes = false;
  let workingKey = '';
  let workingValue = '';
  let workingKeyChar: KeyChar | undefined = undefined;
  let negative = false;

  for (let token of input.split(' ')) {
    
    if (!capturingQuotes && token.length > 1) {
      // Check for "-" negation
      if (token.startsWith("-")) {
        negative = true;

        token = token.slice(1);
      }

      // Check for quick search shortcuts
      if (token.length > 1) {
        let ch = token[0];
        switch (ch) {
          case '#': {
            token = token.slice(1);
            workingKey = "genre";
            break;
          }
          case '!': {
            token = token.slice(1);
            workingKey = "platform";
            break;
          }
          case '@': {
            token = token.slice(1);
            workingKey = "developer";
            break;
          }
        }
      }
    }

    // Opening quotes check
    if (token.startsWith('"')) {
      token = token.slice(1);
      capturingQuotes = true;
    }

    if (capturingQuotes) {
      // Inside quotes, add to working value
      if (workingValue == "") {
        workingValue = token
      } else {
        workingValue += ` ${token}`;
      }
    }

    // Closing quotes check
    if (token.endsWith('"') && capturingQuotes) {
      capturingQuotes = false;
      // Remove quote at end of working value, if doesn't exist then it's a broken quoted value
      const suffixIdx = workingValue.lastIndexOf('"');
      if (suffixIdx > -1) {
        workingValue = workingValue.slice(0, suffixIdx);
      }
    }

    if (capturingQuotes) {
      // Still inside quotes, keep parsing rest of tokens
      continue;
    }

    // Try parsing what we have left into a proper key value pair
    if (!workingValue) {
      const keyChar = getKeyChar(token);

      if (keyChar) {
        console.log(token);
        console.log('keychar ' + keyChar);
        let parts = token.split(keyChar);
        if (parts.length > 1) {
          workingKey = parts[0];
          token = parts.slice(1).join(keyChar);
        }
      }

      // Entire token is wrapped, must be a generic value
      if (token.endsWith('"') && token.startsWith('"')) {
        if (token.length == 2) {
          if (!workingKey) {
            // It has a key? Must be a deliberately empty value, fill with a replacement string for now
            workingValue = REPLACEMENT;
          }
        } else {
          token = token.slice(1, token.length); // Remove quotes
          workingValue = token;
        }
      // Opening quote, but no key yet, must be the start of a spaced generic value
      } else {
        if (token.startsWith('"')) {
          token = token.slice(1);
          capturingQuotes = true;
          workingValue = token;
          continue;
        }
        workingValue = token;
      }
    
      if (workingValue) {
        let exact = false;
        if (workingKey) {
          if (workingValue == REPLACEMENT) {
            workingValue = ""; // Empty it again now we're at the end
            exact = true;
          } else {
            if (workingKeyChar) {
              switch (workingKeyChar) {
                case (KeyChar.EQUALS): {
                  exact = true;
                  break;
                }
                default:
                  break;
              }
            }
          }
        }

        console.log(`key: ${workingKey}, value: ${workingValue}, negative: ${negative}, exact: ${exact}`);

        let list = (negative && exact) ? filter.exactBlacklist :
           (negative && !exact) ? filter.blacklist :
           (!negative && exact) ? filter.exactWhitelist :
           filter.whitelist;

        let value = workingValue; // Reassign here so we can expand typings later, trust me

        // Handle adding string values to filter
        switch (workingKey.toLowerCase()) {
          case 'id': {
            list.id.push(value);
            break;
          }
          case 'title': {
            list.title.push(value);
            break;
          }
          case 'series': {
            list.series.push(value);
            break;
          }
          case 'developer': {
            list.developer.push(value);
            break;
          }
          case 'publisher': {
            list.publisher.push(value);
            break;
          }
          case 'platform': {
            list.platform.push(value);
            break;
          }
          case 'genre': {
            list.genre.push(value);
            break;
          }
          default: {
            if (workingKeyChar) {
              const fullValue = workingKey + workingKeyChar + value;
              list.generic.push(fullValue);
            } else {
              list.generic.push(value)
            }
            break;
          }
        }

        negative = false;
        workingValue = "";
        workingKey = "";
      }
    }
  }

  console.log(filter);

  return filter;
}

function getKeyChar(token: string): KeyChar | undefined {
  let earliestPos = 9999999;
  let earliestKeyChar = "";

  for (const keyChar of KEY_CHARS) {
    const idx = token.indexOf(keyChar);
    if (idx < earliestPos && idx > -1) {
      earliestPos = idx;
      earliestKeyChar = keyChar;
    }
  }

  switch (earliestKeyChar) {
    case '=':
      return KeyChar.EQUALS
    case ':':
      return KeyChar.MATCHES
    default:
      return undefined;
  }
}

export function mergeGameFilters(a: GameFilter, b: GameFilter): GameFilter {
  const newFilter = getDefaultGameFilter();
  newFilter.subfilters = [a, b];

  // If both are match any, then we can match either filter as well
  // If either are match all, then both filter conditions must return true
  if (a.matchAny && b.matchAny) {
    newFilter.matchAny = true;
  }

  return newFilter;
}
