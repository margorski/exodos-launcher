import { History } from "history";
import { applyMiddleware, createStore, Store } from "redux";
import { ApplicationState, createRootReducer } from "./store";
import { createRouterMiddleware } from "@lagunovsky/redux-react-router";

export default function configureStore(
    history: History,
    initialState?: Partial<ApplicationState>
): Store<ApplicationState> {
    return createStore(
        createRootReducer(history),
        initialState,
        applyMiddleware(createRouterMiddleware(history))
    );
}
