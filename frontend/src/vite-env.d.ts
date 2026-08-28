/// <reference types="vite/client" />

declare module 'react-plotly.js/factory' {
  import React from 'react';
  import { Data, Layout, Config } from 'plotly.js';

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: unknown[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    debug?: boolean;
    onInitialized?: (figure: unknown, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: unknown, graphDiv: HTMLElement) => void;
    onPurge?: (figure: unknown, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    divId?: string;
  }

  const createPlotlyComponent: (plotly: unknown) => React.ComponentType<PlotParams>;
  export default createPlotlyComponent;
}
