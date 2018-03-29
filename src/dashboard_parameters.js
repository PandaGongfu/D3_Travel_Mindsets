var BUBBLE_PARAMETERS = {
    "data_file": "visa_travelers.csv",
    "emotion_file": "emotion_score.csv",
    "report_title": "International Travelers - Audience",
    "footer_text": "A demonstration of animated bubble charts in D3.js",
    "width": 940,
    "height": 700,
    "expand": 180,    
    "force_strength": 0.03,
    "force_type": "charge",
    "radius_field": "Population",
    "numeric_fields": ["Population", "Total Spend", "Cash Usage", "Millennials %", "Other Cards Usage", "Index"],
    "fill_color": {
        "data_field": "Tier",
        "color_groups": {
            "Tier 3": "#ffebcd",
            "Tier 2": "#A9A9A9",
            "Tier 1": "#ee3423"
        }
    },
    "visa_blue": "black",
    "tooltip": [
        {"title": "Traveler Type", "data_field": "Traveler Type"},   
        {"title": "Size (MM)", "data_field": "Population"},
        {"title": "Millennials (%)", "data_field": "Millennials %", "format_string": ".0%"},
        {"title": "Total Travel Spend ($)", "data_field": "Total Spend"},
        {"title": "At Destination Spend ($)", "data_field": "At Destination Spend"},
        {"title": "Cash Usage (%)", "data_field": "Cash Usage", "format_string": ".0%"},
        {"title": "Description", "data_field": "Desc"},
    ],
    "modes": [
        {
            "button_text": "All International Travelers",
            "button_id": "all",
            "type": "grid",
            "labels": null,
            "grid_dimensions": {"rows": 1, "columns": 1},
            "data_field": null
        },
        {
            "button_text": "Millennials %",
            "button_id": "millennials",
            "type": "grid",
            "labels": ["Higher than 30%", "28% to 30%", "Lower than 28%"],
            "grid_dimensions": {"rows": 1, "columns": 3},
            "data_field": "Millennials Type"
        },
        {
            "button_text": "Total Spend",
            "button_id": "total_spend",
            "type": "grid",
            "labels": ["more than 2K", "1.5K to 2K", "1K to 1.5K", "less than 1K"],
            "grid_dimensions": {"rows": 2, "columns": 2},
            "data_field": "Total Spend Group"
        },
        {
            "button_text": "At Destination Spend",
            "button_id": "destination_spend",
            "type": "grid",
            "labels": ["more than 1K", "750 to 1K", "500 to 750", "less than 500" ],
            "grid_dimensions": {"rows": 2, "columns": 2},
            "data_field": "At Destination Group"
        },
        {
            "button_text": "Total Spend vs. Cash Usage",
            "button_id": "spend_vs_cash",
            "type": "scatterplot",
            "x_data_field": "Cash Usage",
            "y_data_field": "Total Spend",
            "x_format_string": ".0%",
            "y_format_string": ".0%"
        },
        {
            "button_text": "Total Spend vs. Other Cards Usage",
            "button_id": "spend_vs_card",
            "type": "scatterplot",
            "x_data_field": "Other Cards Usage",            
            "y_data_field": "Total Spend",
            "x_format_string": ".0%",
            "y_format_string": ".0%"
        },

    ]
};