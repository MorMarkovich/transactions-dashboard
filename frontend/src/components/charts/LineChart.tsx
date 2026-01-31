import createPlotlyComponent from 'react-plotly.js/factory'
import * as Plotly from 'plotly.js'
import type { ChartData } from '../../services/types'

const Plot = createPlotlyComponent(Plotly)

interface LineChartProps {
  data: ChartData
  height?: number
}

export default function LineChart({ data, height = 300 }: LineChartProps) {
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
