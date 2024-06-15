import { ReduxRouter } from "@lagunovsky/redux-react-router";
import { createMemoryHistory } from "history";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from './app';
import configureStore from "./configureStore";
import { ContextReducerProvider } from "./context-reducer/ContextReducerProvider";
import { PreferencesContextProvider } from "./context/PreferencesContext";
import { ProgressContext } from "./context/ProgressContext";

(async () => {
    // Toggle DevTools when CTRL+SHIFT+I is pressed
    window.addEventListener("keypress", (event) => {
        if (event.ctrlKey && event.shiftKey && event.code === "KeyI") {
            window.External.toggleDevtools();
            event.preventDefault();
        }
    });

    await window.External.waitUntilInitialized();
    const history = createMemoryHistory();
    const store = configureStore(history);

    const root = ReactDOM.createRoot(
        document.getElementById("root") as HTMLElement
    );
    root.render(
        <Provider store={store}>
            <PreferencesContextProvider>
                <ContextReducerProvider context={ProgressContext}>
                    <ReduxRouter history={history}>
                        <App />
                    </ReduxRouter>
                </ContextReducerProvider>
            </PreferencesContextProvider>
        </Provider>
    );
})();
