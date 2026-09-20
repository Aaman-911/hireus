import { createContext, useContext } from 'react';

/**
 * Contexts and their hooks live here rather than beside their providers:
 * a file that exports both a component and a plain function breaks React
 * Fast Refresh, so the providers stay component-only.
 */

export const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

export const ToastContext = createContext({ toast: () => {}, dismiss: () => {} });
export const useToast = () => useContext(ToastContext);
