import { setAdvancedFilter, setFilterRecommended, setOrderBy, setOrderReverse, setSearchText } from "@renderer/redux/searchSlice";
import { RootState } from "@renderer/redux/store";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import * as React from 'react';
import { useDispatch, useSelector } from "react-redux";
import { GameOrder } from "./GameOrder";
import { OpenIcon } from "./OpenIcon";
import { SimpleButton } from "./SimpleButton";

export type SearchBarProps = {
  view: string;
};

export function SearchBar(props: SearchBarProps) {
  const searchState = useSelector((state: RootState) => state.searchState);
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
        booleans: {
          ...view.advancedFilter.booleans,
          installed: value
        }
      }
    }));
  }

  const onRecommendedChange = (value?: boolean) => {
    dispatch(setFilterRecommended({
      view: props.view,
      value,
    }));
  }

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
            <div className='search-bar-simple-box'>
              <b>Installed</b>
              <ThreeStateCheckbox
                value={view.advancedFilter.booleans.installed}
                onChange={onInstalledChange}/>
            </div>
            <div className='search-bar-simple-box'>
              <b>Recommended</b>
              <ThreeStateCheckbox
                value={view.filterRecommended}
                onChange={onRecommendedChange}/>
            </div>
          </div>
        ))
      }
    </div>
  );
}

type ThreeStateCheckboxProps = {
  value?: boolean;
  onChange: (value?: boolean) => void;
}

function ThreeStateCheckbox(props: ThreeStateCheckboxProps) {
  const { value, onChange } = props;
  
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
    <div className='three-state-checkbox' onClick={handleClick} onContextMenu={() => onChange(undefined)}>
      {value === true && <OpenIcon icon='check'/>}
      {value === false && <OpenIcon icon='x'/>}
      {value === undefined && <div></div>}
    </div>
  );
}