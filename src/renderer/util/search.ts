import { AdvancedFilter } from "@renderer/redux/searchSlice";
import { BooleanFilter, CompareFilter, FieldFilter, GameFilter } from "@shared/interfaces";

enum KeyChar {
  MATCHES = ':',
  EQUALS = '=',
  LESS_THAN = '<',
  GREATER_THAN = '>',
};

const KEY_CHARS = [
  "=",
  ":",
  '<',
  '>',
];

const REPLACEMENT = "awgdty7awgvbduiawdjnujioawd888";

export function getDefaultBooleanFilter(): BooleanFilter {
  return {
    installed: undefined
  };
}

export function getDefaultFieldFilter(): FieldFilter {
  return {
    generic: [],
    id: [],
    title: [],
    series: [],
    developer: [],
    publisher: [],
    platform: [],
    genre: [],
    playMode: [],
    region: [],
    rating: [],
  };
}

export function getDefaultCompareFilter(): CompareFilter {
  return {};
}

export function getDefaultGameFilter(): GameFilter {
  return {
    subfilters: [],
    whitelist: getDefaultFieldFilter(),
    blacklist: getDefaultFieldFilter(),
    exactWhitelist: getDefaultFieldFilter(),
    exactBlacklist: getDefaultFieldFilter(),
    equalTo: getDefaultCompareFilter(),
    greaterThan: getDefaultCompareFilter(),
    lessThan: getDefaultCompareFilter(),
    booleans: getDefaultBooleanFilter(),
    matchAny: false
  };
}

export function parseUserInput(input: string): GameFilter {
  const filter: GameFilter = {
    subfilters: [],
    whitelist: getDefaultFieldFilter(),
    blacklist: getDefaultFieldFilter(),
    exactWhitelist: getDefaultFieldFilter(),
    exactBlacklist: getDefaultFieldFilter(),
    equalTo: getDefaultCompareFilter(),
    greaterThan: getDefaultCompareFilter(),
    lessThan: getDefaultCompareFilter(),
    booleans: getDefaultBooleanFilter(),
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
      workingKeyChar = getKeyChar(token);

      if (workingKeyChar) {
        let parts = token.split(workingKeyChar);
        if (parts.length > 1) {
          workingKey = parts[0];
          token = parts.slice(1).join(workingKeyChar);
        }
      }

      // Entire token is wrapped, must be a generic value
      if (token.endsWith('"') && token.startsWith('"')) {
        if (token.length == 2) {
          if (workingKey !== "") {
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

        console.log(`key: ${workingKey}, value: ${workingValue}, keychar: ${workingKeyChar}, negative: ${negative}, exact: ${exact}`);

        let list = (negative && exact) ? filter.exactBlacklist :
           (negative && !exact) ? filter.blacklist :
           (!negative && exact) ? filter.exactWhitelist :
           filter.whitelist;

        let value = workingValue; // Reassign here so we can expand typings later, trust me

        let processed = true;

        if (workingKeyChar !== undefined) {
          switch (workingKeyChar) {
            case KeyChar.LESS_THAN: {
              switch (workingKey) {
                case 'players':
                case 'maxPlayers': {
                  filter.lessThan.maxPlayers = Number(value);
                  break;
                }
                case 'release':
                case 'releaseDate':
                case 'releaseYear':
                case 'year': {
                  filter.lessThan.releaseYear = value;
                  break;
                }
                default: {
                  processed = false;
                }
              }
              break;
            }
            case KeyChar.GREATER_THAN: {
              switch (workingKey) {
                case 'players':
                case 'maxPlayers': {
                  filter.greaterThan.maxPlayers = Number(value);
                  break;
                }
                case 'release':
                case 'releaseDate':
                case 'releaseYear':
                case 'year': {
                  filter.greaterThan.releaseYear = value;
                  break;
                }
                default: {
                  processed = false;
                }
              }
              break;
            }
            case KeyChar.EQUALS:
            case KeyChar.MATCHES: {
              switch (workingKey) {
                case 'players':
                case 'maxPlayers': {
                  filter.equalTo.maxPlayers = Number(value);
                  break;
                }
                case 'release':
                case 'releaseDate':
                case 'releaseYear':
                case 'year': {
                  filter.equalTo.releaseYear = value;
                  break;
                }
                default: {
                  processed = false;
                }
              }
              break;
            }
            default: {
              processed = false;
            }
          }
        } else {
          processed = false;
        }

        if (!processed) {
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
            case 'region': {
              list.region.push(value);
              break;
            }
            case 'rating': {
              list.rating.push(value);
              break;
            }
            default: {
              // Cheat a little and assume nobody is writing installed or recommended as a value
              if (!workingKeyChar && value.toLowerCase() === 'installed') {
                if (negative) {
                  filter.booleans.installed = false;
                } else {
                  filter.booleans.installed = true;
                }
              } else if (!workingKeyChar && value.toLowerCase() === 'recommended') {
                if (negative) {
                  filter.booleans.recommended = false;
                } else {
                  filter.booleans.recommended = true;
                }
              } else {
                if (workingKeyChar) {
                  const fullValue = workingKey + workingKeyChar + value;
                  list.generic.push(fullValue);
                } else {
                  list.generic.push(value)
                }
              }

              break;
            }
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
    case '>':
      return KeyChar.GREATER_THAN
    case '<':
      return KeyChar.LESS_THAN
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

export function isGameFilterEmpty(filter: GameFilter) {
  return filter.subfilters.length === 0 &&
    isFilterEmpty(filter.whitelist) &&
    isFilterEmpty(filter.blacklist) &&
    isFilterEmpty(filter.exactWhitelist) &&
    isFilterEmpty(filter.exactBlacklist) &&
    isBooleanFilterEmpty(filter.booleans);
}

export function isFilterEmpty(filter: FieldFilter) {
  return !(
    filter.generic.length > 0 ||
    filter.id.length > 0 ||
    filter.title.length > 0 ||
    filter.series.length > 0 ||
    filter.developer.length > 0 ||
    filter.publisher.length > 0 ||
    filter.platform.length > 0 ||
    filter.genre.length > 0 ||
    filter.playMode.length > 0 ||
    filter.region.length > 0 ||
    filter.rating.length > 0
  );
}

export function isCompareFilterEmpty(filter: CompareFilter) {
  return !(
    filter.maxPlayers !== undefined ||
    filter.releaseYear !== undefined
  );
}

export function isBooleanFilterEmpty(filter: BooleanFilter) {
  return !(
    filter.installed !== undefined ||
    filter.recommended !== undefined
  );
}

export function parseAdvancedFilter(filter: AdvancedFilter): GameFilter {
  const newFilter = getDefaultGameFilter();

  newFilter.booleans.installed = filter.installed;
  newFilter.booleans.recommended = filter.recommended;

  if (filter.developer.length > 0) {
    const developerFilter = getDefaultGameFilter();
    developerFilter.matchAny = true;
    developerFilter.whitelist.developer = filter.developer.filter(s => s !== "");
    developerFilter.exactWhitelist.developer = filter.developer.filter(s => s === "");
    newFilter.subfilters.push(developerFilter);
  }

  if (filter.publisher.length > 0) {
    const publisherFilter = getDefaultGameFilter();
    publisherFilter.matchAny = true;
    publisherFilter.whitelist.publisher = filter.publisher.filter(s => s !== "");
    publisherFilter.exactWhitelist.publisher = filter.publisher.filter(s => s === "");
    newFilter.subfilters.push(publisherFilter);
  }

  if (filter.series.length > 0) {
    const seriesFilter = getDefaultGameFilter();
    seriesFilter.matchAny = true;
    seriesFilter.whitelist.series = filter.series.filter(s => s !== "");
    seriesFilter.exactWhitelist.series = filter.series.filter(s => s === "");
    newFilter.subfilters.push(seriesFilter);
  }

  if (filter.genre.length > 0) {
    const genreFilter = getDefaultGameFilter();
    genreFilter.matchAny = true;
    genreFilter.whitelist.genre = filter.genre.filter(s => s !== "");
    genreFilter.exactWhitelist.genre = filter.genre.filter(s => s === "");
    newFilter.subfilters.push(genreFilter);
  }

  if (filter.playMode.length > 0) {
    const playModeFilter = getDefaultGameFilter();
    playModeFilter.matchAny = true;
    playModeFilter.whitelist.playMode = filter.playMode.filter(s => s !== "");
    playModeFilter.exactWhitelist.playMode = filter.playMode.filter(s => s === "");
    newFilter.subfilters.push(playModeFilter);
  }

  if (filter.region.length > 0) {
    const regionFilter = getDefaultGameFilter();
    regionFilter.matchAny = true;
    regionFilter.whitelist.region = filter.region.filter(s => s !== "");
    regionFilter.exactWhitelist.region = filter.region.filter(s => s === "");
    newFilter.subfilters.push(regionFilter);
  }

  if (filter.rating.length > 0) {
    const ratingFilter = getDefaultGameFilter();
    ratingFilter.matchAny = true;
    ratingFilter.whitelist.rating = filter.rating.filter(s => s !== "");
    ratingFilter.exactWhitelist.rating = filter.rating.filter(s => s === "");
    newFilter.subfilters.push(ratingFilter);
  }

  return newFilter;
}