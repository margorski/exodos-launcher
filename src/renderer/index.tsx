import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from './app';
import { ContextReducerProvider } from "./context-reducer/ContextReducerProvider";
import { PreferencesContextProvider } from "./context/PreferencesContext";
import { ProgressContext } from "./context/ProgressContext";
import { Provider } from "react-redux";
import store from "./redux/store";
import { HashRouter } from "react-router-dom";

(async () => {
    // Toggle DevTools when CTRL+SHIFT+I is pressed
    window.addEventListener("keypress", (event) => {
        if (event.ctrlKey && event.shiftKey && event.code === "KeyI") {
            window.External.toggleDevtools();
            event.preventDefault();
        }
    });

    await window.External.waitUntilInitialized();

    const root = ReactDOM.createRoot(
        document.getElementById("root") as HTMLElement
    );
    root.render(
        <Provider store={store}>
            <PreferencesContextProvider>
                <ContextReducerProvider context={ProgressContext}>
                    <HashRouter>
                        <App />
                    </HashRouter>
                </ContextReducerProvider>
            </PreferencesContextProvider>
        </Provider>
    );
})();
