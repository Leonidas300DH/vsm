import { createContext, useContext } from 'react';
import useStore from './useStore';

// Comparison cards resolve resources from their own scenario, never the active editor.
export const GraphContext = createContext(null);
export function useGraphState(selector = state => state) {
  const snapshot = useContext(GraphContext);
  const live = useStore(selector);
  return snapshot ? selector(snapshot) : live;
}
