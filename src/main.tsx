import './index.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';

// Robust polyfill to catch and ignore Performance measure/mark errors (such as DataCloneError)
if (typeof window !== 'undefined' && window.performance) {
  if (window.performance.measure) {
    const originalMeasure = window.performance.measure;
    window.performance.measure = function (
      measureName: string,
      startMarkOrOptions?: any,
      endMark?: string
    ): any {
      try {
        return originalMeasure.call(window.performance, measureName, startMarkOrOptions, endMark);
      } catch (err) {
        console.warn('Caught and bypassed Performance.measure error:', err);
        try {
          // Fallback to name-only call
          return originalMeasure.call(window.performance, measureName);
        } catch (innerErr) {
          return {
            name: measureName,
            entryType: 'measure',
            startTime: 0,
            duration: 0,
            toJSON: () => ({}),
          };
        }
      }
    };
  }

  if (window.performance.mark) {
    const originalMark = window.performance.mark;
    window.performance.mark = function (
      markName: string,
      markOptions?: any
    ): any {
      try {
        return originalMark.call(window.performance, markName, markOptions);
      } catch (err) {
        console.warn('Caught and bypassed Performance.mark error:', err);
        try {
          return originalMark.call(window.performance, markName);
        } catch (innerErr) {
          return {
            name: markName,
            entryType: 'mark',
            startTime: 0,
            duration: 0,
            toJSON: () => ({}),
          };
        }
      }
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

