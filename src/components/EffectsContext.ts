import { createContext, useContext } from "react";
export const EffectsContext = createContext(false);
export const usePerformanceMode = () => useContext(EffectsContext);
