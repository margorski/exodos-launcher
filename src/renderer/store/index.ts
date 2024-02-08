import { History } from "history";
import { combineReducers } from "redux";
import { searchReducer, SearchState } from "./search";
import {
    createRouterReducer,
    ReduxRouterState,
} from "@lagunovsky/redux-react-router";

// The top-level state object
export interface ApplicationState {
    router: ReduxRouterState;
    search: SearchState;
}

// Top-level reducer
export const createRootReducer = (history: History) =>
    combineReducers<ApplicationState>({
        router: createRouterReducer(history),
        search: searchReducer,
    });
