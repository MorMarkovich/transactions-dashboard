"""
Chart generation functions using Plotly
"""
import pandas as pd
import plotly.graph_objects as go


def create_donut_chart(df: pd.DataFrame) -> dict:
    """גרף דונאט מקצועי עם gradient colors"""
    expenses = df[df['סכום'] < 0].copy()
    cat_data = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum().reset_index()
    cat_data = cat_data.sort_values('סכום_מוחלט', ascending=False)

    if cat_data.empty:
        return {
            'data': [],
            'layout': {
                'paper_bgcolor': 'rgba(0,0,0,0)',
                'plot_bgcolor': 'rgba(0,0,0,0)',
                'margin': dict(t=10, b=10, l=10, r=10),
                'height': 280,
                'annotations': [{
                    'text': '📭 אין נתונים',
                    'x': 0.5, 'y': 0.5,
                    'font': dict(size=16, color='#718096', family='Heebo'),
                    'showarrow': False
                }]
            }
        }

    # הצגת 10 קטגוריות מובילות + "אחר"
    if len(cat_data) > 10:
        top = cat_data.head(10).copy()
        other_sum = cat_data.iloc[10:]['סכום_מוחלט'].sum()
        other = pd.DataFrame([{'קטגוריה': 'אחר', 'סכום_מוחלט': other_sum}])
        cat_data = pd.concat([top, other], ignore_index=True)
    
    # צבעי gradient מקצועיים
    premium_colors = ['#667eea', '#38ef7d', '#f5576c', '#4facfe', '#fa709a', '#b794f4', '#f6ad55', '#68d391', '#fc8181', '#63b3ed', '#a0aec0']
    
    total = cat_data['סכום_מוחלט'].sum()
    
    fig = go.Figure(data=[go.Pie(
        labels=cat_data['קטגוריה'],
        values=cat_data['סכום_מוחלט'],
        hole=0.7,
        marker=dict(
            colors=premium_colors[:len(cat_data)],
            line=dict(color='#0a0e14', width=2)
        ),
        textinfo='none',
        hovertemplate='<b>%{label}</b><br>₪%{value:,.0f}<br>%{percent}<extra></extra>',
        showlegend=False,
        rotation=90
    )])
    
    fig.add_annotation(
        text=f"<b style='font-size:24px;color:#fff'>₪{total:,.0f}</b>",
        x=0.5, y=0.55, font=dict(size=24, color='#ffffff', family='Heebo'),
        showarrow=False
    )
    fig.add_annotation(
        text="<span style='color:#a0aec0'>סה״כ הוצאות</span>",
        x=0.5, y=0.42, font=dict(size=13, color='#a0aec0', family='Heebo'),
        showarrow=False
    )
    
    fig.update_layout(
        showlegend=False,
        margin=dict(t=40, b=40, l=40, r=40),
        paper_bgcolor='rgba(0,0,0,0)',
        height=400,
        width=400,
        autosize=False
    )

    # Convert to JSON-serializable format
    import json
    try:
        # Use plotly's to_json() which handles numpy/pandas types correctly
        chart_json = json.loads(fig.to_json())
        return {
            'data': chart_json.get('data', []),
            'layout': chart_json.get('layout', {})
        }
    except Exception as e:
        # Fallback: manual conversion
        data_list = []
        for trace in fig.data:
            trace_dict = trace.to_plotly_json()
            data_list.append(trace_dict)
        
        layout_dict = fig.layout.to_plotly_json()
        return {
            'data': data_list,
            'layout': layout_dict
        }


def create_monthly_bars(df: pd.DataFrame) -> dict:
    """גרף עמודות חודשי עם gradient"""
    expenses = df[df['סכום'] < 0].copy()
    
    if expenses.empty:
        return {
            'data': [],
            'layout': {
                'paper_bgcolor': 'rgba(0,0,0,0)',
                'plot_bgcolor': 'rgba(0,0,0,0)',
                'height': 260,
                'margin': dict(t=10, b=10, l=10, r=10),
                'annotations': [{
                    'text': '📭 אין נתונים',
                    'x': 0.5, 'y': 0.5,
                    'font': dict(size=16, color='#718096'),
                    'showarrow': False
                }]
            }
        }
    
    monthly = expenses.groupby(['חודש']).agg({'סכום_מוחלט': 'sum', 'תאריך': 'first'}).reset_index()
    monthly = monthly.sort_values('תאריך')
    
    # Gradient colors for bars
    n_bars = len(monthly)
    colors = [f'rgba(102, 126, 234, {0.5 + 0.5 * i / max(n_bars-1, 1)})' for i in range(n_bars)]
    
    fig = go.Figure(data=[go.Bar(
        x=monthly['חודש'],
        y=monthly['סכום_מוחלט'],
        marker=dict(
            color=colors,
            line=dict(color='rgba(102, 126, 234, 0.8)', width=1),
            cornerradius=6
        ),
        hovertemplate='<b>%{x}</b><br>₪%{y:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=11), showgrid=False),
        yaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=15, b=35, l=55, r=15), height=260,
        font=dict(family='Heebo'),
        bargap=0.3,
        hoverlabel=dict(bgcolor='#1e2530', font_size=13, font_family='Heebo', bordercolor='#667eea')
    )
    
    # Convert to JSON-serializable format
    import json
    try:
        # Use plotly's to_json() which handles numpy/pandas types correctly
        chart_json = json.loads(fig.to_json())
        return {
            'data': chart_json.get('data', []),
            'layout': chart_json.get('layout', {})
        }
    except Exception as e:
        # Fallback: manual conversion
        data_list = []
        for trace in fig.data:
            trace_dict = trace.to_plotly_json()
            data_list.append(trace_dict)
        
        layout_dict = fig.layout.to_plotly_json()
        return {
            'data': data_list,
            'layout': layout_dict
        }


def create_weekday_chart(df: pd.DataFrame) -> dict:
    """גרף ימים בשבוע עם צבעים מותאמים"""
    days_heb = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    expenses = df[df['סכום'] < 0].copy()
    
    if expenses.empty:
        return {
            'data': [],
            'layout': {
                'paper_bgcolor': 'rgba(0,0,0,0)',
                'plot_bgcolor': 'rgba(0,0,0,0)',
                'height': 230,
                'margin': dict(t=10, b=10, l=10, r=10),
                'annotations': [{
                    'text': '📭 אין נתונים',
                    'x': 0.5, 'y': 0.5,
                    'font': dict(size=16, color='#718096'),
                    'showarrow': False
                }]
            }
        }
    
    daily = expenses.groupby('יום_בשבוע')['סכום_מוחלט'].sum().reset_index()
    daily['יום'] = daily['יום_בשבוע'].apply(lambda x: days_heb[x] if x < 7 else '')
    
    # Purple gradient
    colors = ['#b794f4', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95']
    
    fig = go.Figure(data=[go.Bar(
        x=daily['יום'],
        y=daily['סכום_מוחלט'],
        marker=dict(
            color=[colors[int(d)] for d in daily['יום_בשבוע']],
            line=dict(color='rgba(167, 139, 250, 0.5)', width=1),
            cornerradius=6
        ),
        hovertemplate='<b>יום %{x}</b><br>₪%{y:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=11), showgrid=False),
        yaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=15, b=35, l=55, r=15), height=230,
        font=dict(family='Heebo'),
        bargap=0.25,
        hoverlabel=dict(bgcolor='#1e2530', font_size=13, font_family='Heebo', bordercolor='#b794f4')
    )
    
    # Convert to JSON-serializable format
    import json
    try:
        # Use plotly's to_json() which handles numpy/pandas types correctly
        chart_json = json.loads(fig.to_json())
        return {
            'data': chart_json.get('data', []),
            'layout': chart_json.get('layout', {})
        }
    except Exception as e:
        # Fallback: manual conversion
        data_list = []
        for trace in fig.data:
            trace_dict = trace.to_plotly_json()
            data_list.append(trace_dict)
        
        layout_dict = fig.layout.to_plotly_json()
        return {
            'data': data_list,
            'layout': layout_dict
        }


def create_trend_chart(df: pd.DataFrame) -> dict:
    """גרף מגמה מקצועי עם gradient fill"""
    if df.empty:
        return {
            'data': [],
            'layout': {
                'paper_bgcolor': 'rgba(0,0,0,0)',
                'plot_bgcolor': 'rgba(0,0,0,0)',
                'height': 300,
                'margin': dict(t=10, b=10, l=10, r=10),
                'annotations': [{
                    'text': '📭 אין נתונים',
                    'x': 0.5, 'y': 0.5,
                    'font': dict(size=16, color='#718096'),
                    'showarrow': False
                }]
            }
        }
    
    df_sorted = df.sort_values('תאריך').copy()
    df_sorted['מצטבר'] = df_sorted['סכום'].cumsum()
    
    fig = go.Figure()
    
    # Area with gradient
    fig.add_trace(go.Scatter(
        x=df_sorted['תאריך'], y=df_sorted['מצטבר'],
        mode='lines', fill='tozeroy',
        line=dict(color='#667eea', width=3),
        fillcolor='rgba(102, 126, 234, 0.15)',
        hovertemplate='<b>%{x|%d/%m/%Y}</b><br>מאזן: ₪%{y:,.0f}<extra></extra>'
    ))
    
    # Zero line
    fig.add_hline(y=0, line_dash='dash', line_color='#fc8181', line_width=2, opacity=0.7)
    
    # Add markers for min/max points
    min_idx = df_sorted['מצטבר'].idxmin()
    max_idx = df_sorted['מצטבר'].idxmax()
    
    fig.add_trace(go.Scatter(
        x=[df_sorted.loc[min_idx, 'תאריך']],
        y=[df_sorted.loc[min_idx, 'מצטבר']],
        mode='markers',
        marker=dict(size=12, color='#fc8181', symbol='diamond'),
        hovertemplate='<b>נקודת מינימום</b><br>₪%{y:,.0f}<extra></extra>',
        showlegend=False
    ))
    
    fig.add_trace(go.Scatter(
        x=[df_sorted.loc[max_idx, 'תאריך']],
        y=[df_sorted.loc[max_idx, 'מצטבר']],
        mode='markers',
        marker=dict(size=12, color='#38ef7d', symbol='diamond'),
        hovertemplate='<b>נקודת מקסימום</b><br>₪%{y:,.0f}<extra></extra>',
        showlegend=False
    ))
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True),
        yaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True, zeroline=False),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=20, b=40, l=65, r=20), height=300,
        font=dict(family='Heebo'),
        hoverlabel=dict(bgcolor='#1e2530', font_size=13, font_family='Heebo', bordercolor='#667eea'),
        hovermode='x unified'
    )
    
    # Convert to JSON-serializable format
    import json
    try:
        # Use plotly's to_json() which handles numpy/pandas types correctly
        chart_json = json.loads(fig.to_json())
        return {
            'data': chart_json.get('data', []),
            'layout': chart_json.get('layout', {})
        }
    except Exception as e:
        # Fallback: manual conversion
        data_list = []
        for trace in fig.data:
            trace_dict = trace.to_plotly_json()
            data_list.append(trace_dict)
        
        layout_dict = fig.layout.to_plotly_json()
        return {
            'data': data_list,
            'layout': layout_dict
        }
