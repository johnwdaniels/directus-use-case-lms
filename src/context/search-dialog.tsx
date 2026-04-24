import { createContext, useContext } from 'react';

export type SearchDialogContextValue = {
  openSearch: () => void;
};

export const SearchDialogContext = createContext<SearchDialogContextValue>({
  openSearch: () => {},
});

export function useSearchDialog() {
  return useContext(SearchDialogContext);
}
