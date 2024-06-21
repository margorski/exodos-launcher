import { AdvancedFilter, setAdvancedFilter, setOrderBy, setOrderReverse, setSearchText } from "@renderer/redux/searchSlice";
import store, { RootState } from "@renderer/redux/store";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import * as React from 'react';
import { useDispatch, useSelector } from "react-redux";
import { GameOrder } from "./GameOrder";
import { OpenIcon } from "./OpenIcon";
import { SimpleButton } from "./SimpleButton";
import { ArrowKeyStepper, AutoSizer, List, ListRowProps } from "react-virtualized";

export type SearchBarProps = {
  view: string;
};

export function SearchBar(props: SearchBarProps) {
  const { searchState, gamesState } = useSelector((state: RootState) => state);
  const dispatch = useDispatch();
  const [expanded, setExpanded] = React.useState(true);
  const [advancedMode, setAdvancedMode] = React.useState(false);
  const view = searchState.views[props.view];

  const onTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchText({
      view: props.view,
      text: event.target.value
    }));
  }

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const onKeypress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === "KeyF") {
          const element = searchInputRef.current;
          if (element) {
              element.select();
              event.preventDefault();
          }
      }
  };

  const onChangeOrderBy = (value: GameOrderBy) => {
    dispatch(setOrderBy({
      view: props.view,
      value,
    }))
  };

  const onChangeOrderReverse = (value: GameOrderReverse) => {
    dispatch(setOrderReverse({
      view: props.view,
      value,
    }))
  };

  React.useEffect(() => {
      window.addEventListener('keypress', onKeypress);

      return () => {
          window.removeEventListener('keypress', onKeypress);
      };
  }, []);

  const onInstalledChange = (value?: boolean) => {
    dispatch(setAdvancedFilter({
      view: props.view,
      filter: {
        ...view.advancedFilter,
        installed: value,
      }
    }));
  }

  const onRecommendedChange = (value?: boolean) => {
    dispatch(setAdvancedFilter({
      view: props.view,
      filter: {
        ...view.advancedFilter,
        recommended: value,
      }
    }));
  }

  const onToggleFactory = (key: keyof AdvancedFilter) => {
    return (value: string) => {
      let newValues = [...(view.advancedFilter[key] as string[])];
      const idx = newValues.findIndex(s => s === value);
      if (idx > -1) {
        newValues.splice(idx, 1);
      } else {
        // None is mutually exclusive to every other value
        if (value === "") {
          newValues = [value];
        } else {
          const noneIdx = newValues.findIndex(s => s === "");
          if (noneIdx > -1) {
            newValues.splice(noneIdx, 1);
          }
          newValues.push(value);
        }
      }
  
      dispatch(setAdvancedFilter({
        view: props.view,
        filter: {
          ...view.advancedFilter,
          [key]: newValues,
        }
      }));
    };
  }

  const onClearFactory = (key: keyof AdvancedFilter) => {
    return () => {
      dispatch(setAdvancedFilter({
        view: props.view,
        filter: {
          ...view.advancedFilter,
          [key]: [],
        }
      }));
    };
  }

  // Developer
  const developerItems = React.useMemo(() => {
    const set = new Set(view.games.flatMap(g => g.developer.split(';').map(s => s.trim())));
    return Array.from(set).sort();
  }, [view.games]);
  const onToggleDeveloper = onToggleFactory('developer');
  const onClearDeveloper = onClearFactory('developer');

  // Publisher
  const publisherItems = React.useMemo(() => {
    const set = new Set(view.games.flatMap(g => g.publisher.split(';').map(s => s.trim())));
    return Array.from(set).sort();
  }, [view.games]);
  const onTogglePublisher = onToggleFactory('publisher');
  const onClearPublisher = onClearFactory('publisher');

  // Series
  const seriesItems = React.useMemo(() => {
    const set = new Set(view.games.flatMap(g => g.series.split(';').map(s => s.trim())));
    return Array.from(set).sort();
  }, [view.games]);
  const onToggleSeries = onToggleFactory('series');
  const onClearSeries = onClearFactory('series');

  // Genre
  const genreItems = React.useMemo(() => {
    const set = new Set(view.games.flatMap(g => g.genre.split(';').map(s => s.trim())));
    return Array.from(set).sort();
  }, [view.games]);
  const onToggleGenre = onToggleFactory('genre');
  const onClearGenre = onClearFactory('genre');

  // Region
  const playModeItems = React.useMemo(() => {
    const set = new Set(view.games.flatMap(g => g.playMode.split(';').map(s => s.trim())));
    return Array.from(set).sort();
  }, [view.games]);
  const onTogglePlayMode = onToggleFactory('playMode');
  const onClearPlayMode = onClearFactory('playMode');

  // Region
  const regionItems = React.useMemo(() => {
    const set = new Set(view.games.flatMap(g => g.region.split(';').map(s => s.trim())));
    return Array.from(set).sort();
  }, [view.games]);
  const onToggleRegion = onToggleFactory('region');
  const onClearRegion = onClearFactory('region');

  // Rating
  const ratingItems = React.useMemo(() => {
    const set = new Set(view.games.flatMap(g => g.rating.split(';').map(s => s.trim())));
    return Array.from(set).sort();
  }, [view.games]);
  const onToggleRating = onToggleFactory('rating');
  const onClearRating = onClearFactory('rating');

  return (
    <div className={`search-bar-wrapper ${expanded ?
      advancedMode ? 'search-bar-wrapper--expanded-advanced' : 'search-bar-wrapper--expanded-simple'
      : ''}`}>
      <div className="search-bar">
        <div className="search-bar-icon">
          <OpenIcon icon='magnifying-glass'/>
        </div>
        <input
          ref={searchInputRef}
          placeholder="Search"
          className="search-bar-text-input"
          value={view.text}
          onChange={onTextChange} />
        <GameOrder
          orderBy={view.orderBy}
          orderReverse={view.orderReverse}
          onChangeOrderBy={onChangeOrderBy}
          onChangeOrderReverse={onChangeOrderReverse}/>
        <SimpleButton 
          value={expanded ? "Hide Filters" : "Show Filters"}
          onClick={() => setExpanded(!expanded)}/>
      </div>
      { expanded && 
        (advancedMode ? (
          <div className='search-bar-expansion search-bar-expansion-advanced'>
            test
          </div>
        ) : (
          <div className='search-bar-expansion search-bar-expansion-simple'>
            <ThreeStateCheckbox
              title="Installed"
              value={view.advancedFilter.installed}
              onChange={onInstalledChange}/>
            <ThreeStateCheckbox
              title="Recommended"
              value={view.advancedFilter.recommended}
              onChange={onRecommendedChange}/>
            <SearchableSelect 
              title='Developer'
              onToggle={onToggleDeveloper}
              onClear={onClearDeveloper}
              selected={view.advancedFilter.developer}
              items={developerItems}/>
            <SearchableSelect 
              title='Publisher'
              onToggle={onTogglePublisher}
              onClear={onClearPublisher}
              selected={view.advancedFilter.publisher}
              items={publisherItems}/>
            <SearchableSelect 
              title='Series'
              onToggle={onToggleSeries}
              onClear={onClearSeries}
              selected={view.advancedFilter.series}
              items={seriesItems}/>
            <SearchableSelect 
              title='Genre'
              onToggle={onToggleGenre}
              onClear={onClearGenre}
              selected={view.advancedFilter.genre}
              items={genreItems}/>
            <SearchableSelect 
              title='Play Mode'
              onToggle={onTogglePlayMode}
              onClear={onClearPlayMode}
              selected={view.advancedFilter.playMode}
              items={playModeItems}/>
            <SearchableSelect 
              title='Region'
              onToggle={onToggleRegion}
              onClear={onClearRegion}
              selected={view.advancedFilter.region}
              items={regionItems}/>
            <SearchableSelect 
              title='Rating'
              onToggle={onToggleRating}
              onClear={onClearRating}
              selected={view.advancedFilter.rating}
              items={ratingItems}/>
          </div>
        ))
      }
    </div>
  );
}

type ThreeStateCheckboxProps = {
  value?: boolean;
  title: string;
  onChange: (value?: boolean) => void;
}

function ThreeStateCheckbox(props: ThreeStateCheckboxProps) {
  const { value, onChange, title } = props;
  
  const handleClick = () => {
    if (value === true) {
      onChange(false);
    } else if (value === false) {
      onChange(undefined);
    } else {
      onChange(true);
    }
  };

  // Cycles on left click, clears on right click
  return (
    <div className='search-bar-simple-box' onClick={handleClick}>
      <b>{title}</b>
      <div className='three-state-checkbox' onContextMenu={() => onChange(undefined)}>
        {value === true && <OpenIcon icon='check'/>}
        {value === false && <OpenIcon icon='x'/>}
        {value === undefined && <div></div>}
      </div>
    </div>
  );
}

type SearchableSelectProps = {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onClear: () => void;
}

function SearchableSelect(props: SearchableSelectProps) {
  const { title, items, selected, onToggle, onClear } = props;
  const [expanded, setExpanded] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const onToggleExpanded = () => {
    setExpanded(!expanded);
  }

  // Close dropdown when clicking outside of it
  const handleClickOutside = (event: any) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setExpanded(false);
    }
  };

  React.useEffect(() => {
    // Add event listener to handle clicks outside the dropdown
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup the event listener on component unmount
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      className='search-bar-simple-box'
      onClick={onToggleExpanded}
      onContextMenu={onClear}>
      <div
        className="searchable-select"
        ref={dropdownRef}>
        <div className="searchable-select-header">
          <div className="searchable-select-title">{title}</div>
          { selected.length > 0 && (
            <div className="searchable-select-number">{selected.length}</div>
          )}
          <div className="searchable-select-chevron">
            { expanded ? (
              <OpenIcon icon='chevron-top'/>
            ) : (
              <OpenIcon icon='chevron-bottom'/>
            )}
          </div>
        </div>
        {expanded && (
          <SearchableSelectDropdown
            items={items}
            onToggle={onToggle}
            selected={selected}
            />
        )}
      </div>
    </div>
  );
}

type SearchableSelectDropdownProps = {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}

function SearchableSelectDropdown(props: SearchableSelectDropdownProps) {
  const { items, selected, onToggle } = props;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [search, setSearch] = React.useState('');
  const [storedItems, setStoredItems] = React.useState(items); // 'cache' the items

  const filteredItems = React.useMemo(() => {
    const lowerSearch = search.toLowerCase().replace(' ', '');
    return storedItems.filter((item) => item.toLowerCase().replace(' ', '').includes(lowerSearch));
  }, [search, storedItems]);
  console.log(filteredItems);

  // Update the stored items when all selections removed
  // Too difficult to do this any other way
  React.useEffect(() => {
    if (selected.length === 0) {
      setStoredItems(items);
    }
  }, [items]);

  const rowRenderer = (props: ListRowProps) => {
    const { style } = props;
    const item = filteredItems[props.index];
    console.log(filteredItems[0]);

    const marked = selected.includes(item);
          
    return (
      <div
        style={style}
        title={item ? item : 'None'}
        className={`searchable-select-dropdown-item ${marked && 'searchable-select-dropdown-item--selected'}`}
        onClick={() => onToggle(item)}
        key={item}>
        <div className="searchable-select-dropdown-item-title">
          {item ? item : <i>None</i>}
        </div>
        { marked && (
          <div className="searchable-select-dropdown-item-marked">
            <OpenIcon icon='check'/>
          </div>
        )}
      </div>
    )
  }

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []); 

  return (
    <div 
      onClick={(event) => {
        // Prevent bubble up
        event.stopPropagation();
        event.preventDefault();
        return -1;
      }}
      className="searchable-select-dropdown">
      <input 
        ref={inputRef}
        className="searchable-select-dropdown-search-bar"
        value={search}
        placeholder="Search"
        onChange={(event) => setSearch(event.currentTarget.value)}/>
      <div className="searchable-select-dropdown-results">
        <AutoSizer>
          {({ width, height }) => {
            return (
              <ArrowKeyStepper
                mode="cells"
                isControlled={true}
                columnCount={1}
                rowCount={filteredItems.length}
                >
                  {({
                    onSectionRendered
                  }) => (
                    <List
                      className="simple-scroll"
                      width={width}
                      height={height}
                      overscanRowCount={20}
                      rowCount={filteredItems.length}
                      rowHeight={30}
                      rowRenderer={rowRenderer}
                      onSectionRendered={onSectionRendered}
                      />
                  )}
              </ArrowKeyStepper>
            )
          }}
        </AutoSizer>
      </div>
    </div>
  );
}
