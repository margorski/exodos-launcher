import { configureStore } from '@reduxjs/toolkit';
import gamesReducer from './gamesSlice';
import { listenerMiddleware } from './listenerMiddleware';
import { addGamesMiddleware } from './gamesMiddleware';

// Initialize all store middleware
addGamesMiddleware();

// Create store
export const store = configureStore({
  reducer: {
    gamesState: gamesReducer,
  },
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware().prepend(listenerMiddleware.middleware);
  }
});

// Create typings for the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;