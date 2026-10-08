import duckdb
from pathlib import Path
from dash import Dash, html, dcc, callback, Output, Input
import dash_ag_grid as dag
import dash_bootstrap_components as dbc
import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio

db_path = Path(__file__).resolve().parent.parent / "dbt_project" / "dev.duckdb"
con = duckdb.connect(str(db_path), read_only=True)
annual = con.sql("SELECT * FROM annual_aggregate").df()
all = con.sql("SELECT * FROM full_output").df()

external_stylesheets = [dbc.themes.DARKLY]
app = Dash(__name__, external_stylesheets=external_stylesheets)

year_min = int(all["year_released"].min())
year_max = int(all["year_released"].max())

pio.templates.default = "plotly_dark"

app.layout = dbc.Container([
    dbc.Row([
        html.H1('"LEGO\'s far too expensive these days!"', className='display-4'),
        html.P("We all know that, right? Don't we? Let's take a look at sets, prices, themes, and Big Macs.", className="lead"),
        html.Hr(className="my-3")
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
                className="d-flex align-items-baseline"),
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
    ]),
    dbc.Row([
        dbc.Col([
            dcc.Graph(figure={},
                      id='bubble-chart'),
        ], width=11),
        dbc.Col([
            dcc.RangeSlider(min = year_min,
                            max = year_max,
                            step = 1,
                            value = [year_min, year_max],
                            allowCross = False,
                            vertical = True,
                            id='year-range'),
        ], width=1)
    ]),
    dbc.Row([
        dbc.Col([
            dcc.RadioItems(
                options=[
                    {'label': 'Theme Group', 'value': 'theme_l1'},
                    {'label': 'Theme', 'value': 'theme_l2'},
                ],
                value='theme_l2',
                inline=True,
                id='bubble-grouping',
            ),
        ], width=12)
    ])
],
class_name="dbc")

@callback(
    Output(component_id='controls-and-graph', component_property='figure'),
    Input(component_id='controls-and-radio-item', component_property='value')
)

def update_graph(col_chosen):
    fig = px.bar(
        annual, x='year',
        y=col_chosen,
        labels={
            "ppbm_us": "Pieces per US Big Mac",
            "ppbm_gb": "Pieces per UK Big Mac",
            "ppbm_eu": "Pieces per European Big Mac",
        }
    )
    return fig

@callback(
    Output("bubble-chart", "figure"),
    Input("year-range", "value"),
    Input("bubble-grouping", "value"),
)

def update_bubble(year_range, grouping):
    start_year, end_year = year_range
    filtered = all[all["year_released"].between(start_year, end_year) & (all["theme_l2"] != "Serious Play")]

    group_columns = ["theme_l1"] if grouping == "theme_l1" else ["theme_l1", "theme_l2"]
    bubble_summary = filtered.groupby(
        group_columns, as_index=False
    ).agg(
        count=("set_number", "count"),
        median_pieces=("pieces", "median"),
        median_price=("retail_gbp", "median"),
    )

    fig = px.scatter(
        bubble_summary,
        x="median_price",
        y="median_pieces",
        size="count",
        color="theme_l1",
        hover_name=grouping,
        labels={
            "median_price": "Median Price",
            "median_pieces": "Median Pieces",
            "count": "Number of sets",
            "theme_l1": "Theme Group",
        },
        height=600,        
    )

    fig.update_xaxes(tickprefix="£", tickformat=",.0f")
    fig.update_yaxes(tickformat=",.0f")
    fig.update_traces(marker={"sizemin": 3})

    return fig

if __name__ == '__main__':
    app.run(debug=True)