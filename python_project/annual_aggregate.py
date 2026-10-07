import duckdb
from pathlib import Path
from dash import Dash, html, dcc, callback, Output, Input
import dash_ag_grid as dag
import dash_bootstrap_components as dbc
import plotly.express as px

db_path = Path(__file__).resolve().parent.parent / "dbt_project" / "dev.duckdb"
con = duckdb.connect(str(db_path), read_only=True)
annual = con.sql("SELECT * FROM annual_aggregate").df()

external_stylesheets = [dbc.themes.CERULEAN]
app = Dash(__name__, external_stylesheets=external_stylesheets)

app.layout = dbc.Container([
    dbc.Row([
        html.Div(children='LEGO Table!'),
        html.Hr()
    ]),
    dbc.Row([
        html.Div([
            html.P([
                "Choose from: ",
                dcc.RadioItems(
                            options=[
                                {'label': 'US Big Macs', 'value': 'ppbm_us'},
                                {'label': 'UK Big Macs', 'value': 'ppbm_gb'},
                                {'label': 'EU Big Macs', 'value': 'ppbm_eu'}],
                            inline=True,
                            id='controls-and-radio-item',
                            value='ppbm_us',
                            className="ms-1 me-1")
                ],
                className="d-flex align-items-center"),
        ])
    ]),
    dbc.Row([
        dbc.Col([
            dag.AgGrid(rowData=annual.to_dict('records'),
                       columnDefs=[{"field": i} for i in annual.columns]),
        ], width=6),
        dbc.Col([
            dcc.Graph(figure={},
                      id='controls-and-graph'),
        ], width=6)
    ])
])

@callback(
    Output(component_id='controls-and-graph', component_property='figure'),
    Input(component_id='controls-and-radio-item', component_property='value')
)

def update_graph(col_chosen):
    fig = px.bar(annual, x='year', y=col_chosen)
    return fig

if __name__ == '__main__':
    app.run(debug=True)