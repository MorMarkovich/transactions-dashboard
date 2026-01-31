/// <reference types="vite/client" />

declare module 'react-plotly.js/factory' {
  import React from 'react';
  import { Data, Layout, Config } from 'plotly.js';

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: any[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    debug?: boolean;
    onInitialized?: (figure: any, graphDiv: any) => void;
    onUpdate?: (figure: any, graphDiv: any) => void;
    onPurge?: (figure: any, graphDiv: any) => void;
    onError?: (err: Error) => void;
    divId?: string;
  }

  const createPlotlyComponent: (plotly: any) => React.ComponentType<PlotParams>;
  export default createPlotlyComponent;
}
