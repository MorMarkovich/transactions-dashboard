/// <reference types="vite/client" />

declare module 'react-plotly.js/factory' {
  import { Component } from 'react';
  import { PlotlyHTMLElement, Data, Layout, Config } from 'plotly.js';

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: any[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    debug?: boolean;
    onInitialized?: (figure: Readonly<PlotlyHTMLElement>, graphDiv: Readonly<PlotlyHTMLElement>) => void;
    onUpdate?: (figure: Readonly<PlotlyHTMLElement>, graphDiv: Readonly<PlotlyHTMLElement>) => void;
    onPurge?: (figure: Readonly<PlotlyHTMLElement>, graphDiv: Readonly<PlotlyHTMLElement>) => void;
    onError?: (err: Error) => void;
    divId?: string;
  }

  export default class Plot extends Component<PlotParams> {}
}
