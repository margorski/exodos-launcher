import { configureStore } from '@reduxjs/toolkit';
import gamesReducer from './gamesSlice';
import searchReducer from './searchSlice';
import { listenerMiddleware } from './listenerMiddleware';
import { addGamesMiddleware } from './gamesMiddleware';
import { addSearchMiddleware } from './searchMiddleware';

// Initialize all store middleware
addGamesMiddleware();
addSearchMiddleware();

// Create store
export const store = configureStore({
  reducer: {
    gamesState: gamesReducer,
    searchState: searchReducer,
  },
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware().prepend(listenerMiddleware.middleware);
  }
});

// Create typings for the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;