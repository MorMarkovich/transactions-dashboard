import createPlotlyComponent from 'react-plotly.js/factory'
import * as Plotly from 'plotly.js'
import type { ChartData } from '../../services/types'

const Plot = createPlotlyComponent(Plotly)

interface BarChartProps {
  data: ChartData
  height?: number
}

export default function BarChart({ data, height = 260 }: BarChartProps) {
  return (
    <div className="chart-container">
      <Plot
        data={data.data}
        layout={{
          ...data.layout,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
        }}
        config={{ displayModeBar: false }}
        style={{ width: '100%', height: `${height}px` }}
      />
    </div>
  )
}
