import * as Plotly from 'plotly.js'
import createPlotlyComponent from 'react-plotly.js/factory'
import type { ChartData } from '../../services/types'

const Plot = createPlotlyComponent(Plotly)

interface DonutChartProps {
  data: ChartData
}

export default function DonutChart({ data }: DonutChartProps) {
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
        style={{ width: '100%', height: '400px' }}
      />
    </div>
  )
}
