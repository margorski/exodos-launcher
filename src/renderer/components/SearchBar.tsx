import { RootState } from "@renderer/redux/store";
import { useSelector } from "react-redux";
import { OpenIcon } from "./OpenIcon";
import * as React from 'react';
import { useDispatch } from "react-redux";
import { setOrderBy, setOrderReverse, setSearchText } from "@renderer/redux/searchSlice";
import { Dropdown } from "./Dropdown";
import { GameOrder } from "./GameOrder";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";

export type SearchBarProps = {
  view: string;
};

export function SearchBar(props: SearchBarProps) {
  const searchState = useSelector((state: RootState) => state.searchState);
  const dispatch = useDispatch();
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

  return (
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
    </div>
  );
}