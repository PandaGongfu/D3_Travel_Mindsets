/* Bubble chart
 * 
 * Based on Jim Vallandingham's work
 * Organization and style inspired by:
 * https://bost.ocks.org/mike/chart/
 *
 */

function createBubbleChart() {
    /* bubbleChart creation function. Returns a function that will
     * instantiate a new bubble chart given a DOM element to display
     * it in and a dataset to visualize.
     */

    // Tooltip object for mouseover functionality, width 200
    var tooltip = floatingTooltip('bubble_chart_tooltip', 200);
    // These will be set in the `bubbleChart` function
    var svg = null, inner_svg = null;
    var all_data = null
    var bubbles = null;
    var forceSim = null;
    var fillColorScale = null;
    var radiusScale = null;
    var nodes = [];
    var nodes_data = [];
    var margin = null;
    var width = null;
    var height = null;
    var dataExtents = {};
    // For scatterplots (initialized if applicable)
    var xAxis = null;
    var yAxis = null;
    var xScale = null;
    var yScale = null;
    // For the map
    var bubbleMercProjection = d3.geoMercator()
        .rotate([-180, 0]);

    function getFillColorScale() {
        // Obtain a color mapping from keys to color values specified in our parameters file

        // Get the keys and values from the parameters file
        var color_groupsKeys = Object.keys(BUBBLE_PARAMETERS.fill_color.color_groups)
        var color_groupsValues = []
        for (var i=0; i<color_groupsKeys.length; i++) {
            var key = color_groupsKeys[i]
            color_groupsValues.push(BUBBLE_PARAMETERS.fill_color.color_groups[key])
        }
        
        // Generate the key -> value mapping for colors
        var fillColorScale = d3.scaleOrdinal()
            .domain(color_groupsKeys)
            .range(color_groupsValues);

        return fillColorScale;
    }
    
    function createNodes(rawData) {
        /*
         * This data manipulation function takes the raw data from
         * the CSV file and converts it into an array of node objects.
         * Each node will store data and visualization values to visualize
         * a bubble.
         *
         * rawData is expected to be an array of data objects, read in from
         * one of d3's loading functions like d3.csv.
         *
         * This function returns the new node array, with a node in that
         * array for each element in the rawData input.
         */
        // Use map() to convert raw data into node data.
        var myNodes = rawData.map(function (data_row) {
            node = {
                id: data_row.id,
                scaled_radius: radiusScale(+data_row[BUBBLE_PARAMETERS.radius_field]),
                actual_radius: +data_row[BUBBLE_PARAMETERS.radius_field],
                fill_color_group: data_row[BUBBLE_PARAMETERS.fill_color.data_field],
                // icon: 'src/img/react.png',
                // Put each node initially in a random location
                x: Math.random() * width,
                y: Math.random() * height,
                // name: data_row['Traveler Type']
            };
            for(var key in data_row) {
                // Skip loop if the property is from prototype
                if (!data_row.hasOwnProperty(key)) continue;
                node[key] = data_row[key];
            }
            
            return node;
        });

        // Sort them to prevent occlusion of smaller nodes.
        myNodes.sort(function (a, b) { return b.actual_radius - a.actual_radius; });

        return myNodes;
    }

    function loadEmotions(rawEmotion) {
        var emotion_data = rawEmotion.map(function (data_row) { 
            emotion_row = []
            for(var key in data_row){

                if(key != "Index" && key!="Traveler Type" ) {
                    emotion_row.push({axis: key, value: +data_row[key]})
                }
            }
            return emotion_row;
        })
        return emotion_data;
    }

    function getGridTargetFunction(mode) {
        // Given a mode, return an anonymous function that maps nodes to target coordinates
        if (mode.type != "grid") {
            throw "Error: getGridTargetFunction called with mode != 'grid'";
        }
        return function (node) {
            // Given a mode and node, return the correct target
            if(mode.size == 1) {
                // If there is no grid, our target is the default center
                target = mode.gridCenters[""];
            } else {
                // If the grid size is greater than 1, look up the appropriate target
                // coordinate using the relevant node_tag for the mode we are in
                node_tag = node[mode.dataField]
                target = mode.gridCenters[node_tag];
            }
            return target;
        }
    }
    
    function showLabels(mode) {
        /*
         * Shows labels for each of the positions in the grid.
         */
        var currentLabels = mode.labels; 
        var bubble_group_labels = inner_svg.selectAll('.bubble_group_label')
            .data(currentLabels);

        var grid_element_half_height = height / (mode.gridDimensions.rows * 2);
            
        bubble_group_labels.enter().append('text')
            .attr('class', 'bubble_group_label')
            .attr('x', function (d) { return mode.gridCenters[d].x; })
            .attr('y', function (d) { return mode.gridCenters[d].y - grid_element_half_height; })
            .attr('text-anchor', 'middle')                // centre the text
            .style('fill', BUBBLE_PARAMETERS.visa_blue)
            .style('font-weight', 'bold')
            .attr('dominant-baseline', 'hanging') // so the text is immediately below the bounding box, rather than above
            .text(function (d) { return d; });
    }

    function tooltipContent(d, expand=false) {
        /*
         * Helper function to generate the tooltip content
         * 
         * Parameters: d, a dict from the node
         * Returns: a string representing the formatted HTML to display
         */
        var content = ''

        // Loop through all lines we want displayed in the tooltip
        for(var i=0; i<BUBBLE_PARAMETERS.tooltip.length; i++) {
            var cur_tooltip = BUBBLE_PARAMETERS.tooltip[i];
            var value_formatted;

            // If a format was specified, use it
            if ("format_string" in cur_tooltip) {
                value_formatted = 
                    d3.format(cur_tooltip.format_string)(d[cur_tooltip.data_field]);
            } else {
                value_formatted = d[cur_tooltip.data_field];
            }
            
            // If there was a previous tooltip line, add a newline separator
            if (i > 0) {
                content += '<br/>';
            }
            if (expand && i==0) continue;
                
            content += '<span class="name">'  + cur_tooltip.title + ': </span>';
            content += '<span class="value">' + value_formatted     + '</span>';
        }        

        return content;
    }

    function showTooltip(d) {
        /*
         * Function called on mouseover to display the
         * details of a bubble in the tooltip.
         */
        tooltip.showTooltip(tooltipContent(d), d3.event);

        // Display Radar Chart
        showRadarChart(d.Index);

    }
        
    function hideOutline(d) {
        // Reset the circle's outline back to its original color.
        var originalColor = d3.rgb(fillColorScale(d.fill_color_group)).darker()
        d3.select(this).attr('stroke', originalColor)
        .attr('stroke-width', 0);
    }

    function hideTooltip(d) {
        /*
         * Hide tooltip
         */
        tooltip.hideTooltip();
    }

    function ticked() {
        bubbles.each(function (node) {})
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });
    }

    function node_ticked() {
        all_nodes.each(function (node) {})
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .select('circle')
                .attr('r', d => d.r);
    }

    function showAxis(mode) {
        /*
         *  Show the axes.
         */

        // Set up axes
        xAxis = xScale; //d3.scaleBand().rangeRound([0, width]).padding(0.1);
        yAxis = yScale; //d3.scaleLinear().rangeRound([height, 0]);  

        inner_svg.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xAxis))
        inner_svg.append("text")
            .attr("class", "axis axis--x label")
            .attr("transform", "translate(" + (width/2) + " , " + (height) + ")")
            // so the text is immediately below the bounding box, rather than above
            .attr('dominant-baseline', 'hanging')
            .attr("dy", "1.5em")
            .style("text-anchor", "middle")
            .style('font-weight', 'bold')
            .style('fill', BUBBLE_PARAMETERS.visa_blue)
            .style('font-size', '16px')
            .text(mode.xDataField);

        inner_svg.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(yAxis).ticks(10))//, "%"))
        
        inner_svg.append("text")
            .attr("class", "axis axis--y label")
            // We need to compose a rotation with a translation to place the y-axis label
            .attr("transform", "translate(" + 0 + ", " + (height/2) + ")rotate(-90)")
            .attr("dy", "-3em")
            .attr("text-anchor", "middle")
            .style('font-weight', 'bold')
            .style('fill', BUBBLE_PARAMETERS.visa_blue)
            .style('font-size', '16px')
            .text(mode.yDataField);
    }

    function createBubbles(all_data) {
        // Bind nodes data to what will become DOM elements to represent them.

        let centerX = width * 0.5;
        let centerY = height * 0.5;
        // let strength = 0.05;
        // let focusedNode;

        let scaleColor = d3.scaleOrdinal(d3.schemeCategory20);

        let pack = d3.pack()
            .size([width, height ])
            .padding(1.5);

        let forceCollide = d3.forceCollide(d => d.r + 1);

        //use the force
        let simulation = d3.forceSimulation()
            .force('charge', d3.forceManyBody())
            .force('collide', forceCollide)
            .force('x', d3.forceX(centerX ).strength(BUBBLE_PARAMETERS.force_strength))
            .force('y', d3.forceY(centerY ).strength(BUBBLE_PARAMETERS.force_strength));

        let root = d3.hierarchy({ children: all_data})
            .sum(d => d.actual_radius);

        // we use pack() to automatically calculate radius conveniently only
        // and get only the leaves
        let nodes_data = pack(root).leaves().map(node => {
            const data = node.data;
            node_dict = {
                x: centerX + (node.x - centerX) * 3, // magnify start position to have transition to center movement
                y: centerY + (node.y - centerY) * 3,
                r: 0, // for tweening
                radius: node.r, //original radius
            };

            for(var key in data) {
                // Skip loop if the property is from prototype
                if (!data.hasOwnProperty(key)) continue;
                node_dict[key] = data[key];
            }

            return node_dict;
        });

        let node = inner_svg.selectAll('.node')
            .data(nodes_data)
            .enter()
            .append('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', (d) => {
                    if (!d3.event.active) { simulation.alphaTarget(0.2).restart(); }
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (d) => {
                    d.fx = d3.event.x;
                    d.fy = d3.event.y;
                })
                .on('end', (d) => {
                    if (!d3.event.active) { simulation.alphaTarget(0); }
                    d.fx = null;
                    d.fy = null;
                }))
            ;

        node.append('circle')
            .attr('id', d => d.id)
            .attr('r', 0)

            .attr('fill', function (d) { return fillColorScale(d.fill_color_group); })
            .attr('stroke', function (d) { return d3.rgb(fillColorScale(d.fill_color_group)); })
            .attr('stroke-width', 3)
            // .on('click', showTooltip)
            // .on('mouseout', hideOutline)

            .transition().duration(2000).ease(d3.easeElasticOut)
                .tween('circleIn', (d) => {
                    let i = d3.interpolateNumber(0, d.scaled_radius);
                    return (t) => {
                        d.r = i(t);
                        simulation.force('collide', forceCollide);
                    };
                })
                ;

        node.append('image')
        .classed('node-icon', true)
        .attr('xlink:href', d => 'src/icon/' + d.Icon + '.png')
        .attr('x', d => -d.scaled_radius * 0.7)
        .attr('y', d => -d.scaled_radius * 0.7)
        .attr('height', d => d.scaled_radius * 2 * 0.7)
        .attr('width', d => d.scaled_radius * 2 * 0.7)
        // .on('click', showTooltip)
        // .on('mouseout', hideOutline);
        // simulation.nodes(nodes_data).on('tick', node_ticked);

        node.append('circle')
        .attr('class', 'image-border')
        .attr('r', d=> d.scaled_radius)
        .on('click', showTooltip);

        all_nodes = d3.selectAll('.node');

        // Color legend
        let colorScale = d3.scaleOrdinal()
            .domain(["Tier 1", "Tier 2", "Tier 3"])
            .range(["#ee3423", "#A9A9A9", "#ffebcd"] );
            // .range(["#7aa25c", "#beccae", "#d84b2a"] );


        let legendOrdinal = d3.legendColor()
            .scale(colorScale)
            .shape('circle');

        svg.append('g')
            .classed('legend-color', true)
            .attr('text-anchor', 'start')
            .attr('transform', 'translate(780,50)')
            .style('font-size', '16px')
            .call(legendOrdinal);

        svg.on('dblclick', hideTooltip);

        return [node, nodes_data, simulation];
    }

    function addBubbleExpansion(node, nodes_data, targetFunction, simulation) {
        // Focused Node Expansion
        let focusedNode;

        let forceCollide = d3.forceCollide(d => d.r + 1);

        // let simulation = d3.forceSimulation()
        //     .force('charge', d3.forceManyBody())
        //     .force('collide', forceCollide)
        //     .force('x', d3.forceX( d => targetFunction(d).x ).strength(BUBBLE_PARAMETERS.force_strength))
        //     .force('y', d3.forceY( d => targetFunction(d).y ).strength(BUBBLE_PARAMETERS.force_strength));

        let infoBox = node.append('foreignObject')
            .classed('circle-overlay hidden', true)
            .attr('x', -350 * 0.5 * 0.8)
            .attr('y', -350 * 0.5 * 0.8)
            .attr('height', 350 * 0.8)
            .attr('width', 350 * 0.8)
                .append('xhtml:div')
                .classed('circle-overlay__inner', true);

        infoBox.append('h2')
            .classed('circle-overlay__title', true)
            .text(d => d['Traveler Type']);

        infoBox.append('p')
            .classed('circle-overlay__body', true)
            .html(d => d.Desc);

        infoBox.append('p')
            .classed('circle-overlay__body', true)
            .html(function(d) {return tooltipContent(d, true)});

        simulation.nodes(nodes_data).on('tick', node_ticked);

        node.on('click', (currentNode) => {
            d3.event.stopPropagation();
            console.log('currentNode', currentNode);
            let currentTarget = d3.event.currentTarget; // the <g> el

            if (currentNode === focusedNode) {
                // no focusedNode or same focused node is clicked
                return;
            }
            let lastNode = focusedNode;
            focusedNode = currentNode;

            simulation.alphaTarget(0.2).restart();
            // hide all circle-overlay
            d3.selectAll('.circle-overlay').classed('hidden', true);
            d3.selectAll('.node-icon').classed('node-icon--faded', false);

            // don't fix last node to center anymore
            if (lastNode) {
                lastNode.fx = null;
                lastNode.fy = null;
                node.filter((d, i) => i === lastNode.index)
                    .transition().duration(2000).ease(d3.easePolyOut)
                    .tween('circleOut', () => {
                        let irl = d3.interpolateNumber(lastNode.r, lastNode.scaled_radius);
                        return (t) => {
                            lastNode.r = irl(t);
                        };
                    })
                    .on('interrupt', () => {
                        lastNode.r = lastNode.scaled_radius;
                    });
            }

            // if (!d3.event.active) simulation.alphaTarget(0.5).restart();

            d3.transition().duration(1000).ease(d3.easePolyOut)
                .tween('moveIn', () => {
                    console.log('tweenMoveIn', currentNode);
                    let ix = d3.interpolateNumber(currentNode.x, targetFunction(currentNode).x);
                    let iy = d3.interpolateNumber(currentNode.y, targetFunction(currentNode).y);
                    let ir = d3.interpolateNumber(currentNode.r, BUBBLE_PARAMETERS.expand);
                    return function (t) {
                        // console.log('i', ix(t), iy(t));
                        currentNode.fx = ix(t);
                        currentNode.fy = iy(t);
                        currentNode.r = ir(t);
                        simulation.force('collide', forceCollide);
                    };
                })
                .on('end', () => {
                    simulation.nodes(nodes_data).on('tick', node_ticked);
                    // simulation.alphaTarget(0);
                    let $currentGroup = d3.select(currentTarget);
                    $currentGroup.select('.circle-overlay')
                        .classed('hidden', false);
                    $currentGroup.select('.node-icon')
                        .classed('node-icon--faded', true);

                })
                .on('interrupt', () => {
                    console.log('move interrupt', currentNode);
                    currentNode.fx = null;
                    currentNode.fy = null;
                    simulation.alphaTarget(0);
                });
        });

        // blur
        d3.select(document).on('click', () => {
            let target = d3.event.target;
            // check if click on document but not on the circle overlay
            if (!target.closest('#circle-overlay') && focusedNode) {
                focusedNode.fx = null;
                focusedNode.fy = null;
                simulation.alphaTarget(0.2).restart();
                d3.transition().duration(1000).ease(d3.easePolyOut)
                    .tween('moveOut', function () {
                        console.log('tweenMoveOut', focusedNode);
                        let ir = d3.interpolateNumber(focusedNode.r, focusedNode.scaled_radius);
                        return function (t) {
                            focusedNode.r = ir(t);
                            simulation.force('collide', forceCollide);
                        };
                    })
                    .on('end', () => {
                        focusedNode = null;
                        simulation.alphaTarget(0);
                    })
                    .on('interrupt', () => {
                        simulation.alphaTarget(0);
                    });

                // hide all circle-overlay
                d3.selectAll('.circle-overlay').classed('hidden', true);
                d3.selectAll('.node-icon').classed('node-icon--faded', false);
            }
        });
    }
    
    function addForceLayout(isStatic) {
        if (forceSim) {
            // Stop any forces currently in progress
            forceSim.stop();
        }

        // Configure the force layout holding the bubbles apart
        forceSim = d3.forceSimulation()
            .nodes(nodes_data)
            .velocityDecay(0.3)
            .on("tick", node_ticked);    
        
        if (!isStatic) {
            // Decide what kind of force layout to use: "collide" or "charge"
            if(BUBBLE_PARAMETERS.force_type == "collide") {
                var bubbleCollideForce = d3.forceCollide()
                    .radius(function(d) { return d.scaled_radius + 0.5; })
                    .iterations(4)
                forceSim
                    .force("collide", bubbleCollideForce)
            }
            if(BUBBLE_PARAMETERS.force_type == "charge") {
                function bubbleCharge(d) {
                    return -Math.pow(d.scaled_radius, 2.0) * (+BUBBLE_PARAMETERS.force_strength);
                }  
                var bubbleCollideForce = d3.forceCollide()
                    .radius(function(d) { return d.scaled_radius + 0.5; })
                    .iterations(4)
                forceSim
                    .force('charge', d3.forceManyBody().strength(bubbleCharge))
                    .force("collide", bubbleCollideForce );
                    // .force('charge', d3.forceManyBody())
                    // .force("collide", forceCollide );
            }
        }
    }

    function createCanvas(parentDOMElement) {
        // Create a SVG element inside the provided selector with desired size.
        svg = d3.select(parentDOMElement)
            .append('svg')
            .attr('width', BUBBLE_PARAMETERS.width)
            .attr('height', BUBBLE_PARAMETERS.height);

        // Specify margins and the inner width and height
        margin = {top: 20, right: 20, bottom: 50, left: 80},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

        // Create an inner SVG panel with padding on all sides for axes
        inner_svg = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");        
    }   

    function showRadarChart(selectedIndex) {
        var sect = document.getElementById("inds");
        var section = sect.options[selectedIndex].value;

        d3.select('#inds').property('value', section);

        radar_data = [emotion_data[section]];
        radarChartOptions.color = d3.scaleOrdinal()
                                    .range([color(section)]);
        radarChartOptions.prevRlines = [d3.selectAll('.radarArea').attr('d')];  

        radarChartOptions.prevCx = []
        radarChartOptions.prevCy = []
        d3.selectAll('.radarCircle').each(function() {
          radarChartOptions.prevCx.push(d3.select(this).attr('cx'));
          radarChartOptions.prevCy.push(d3.select(this).attr('cy'));
        })

        RadarChart(".radarChart", radar_data, radarChartOptions); 
    }

    //////////////////////////////////////////////////////////////
    
    var bubbleChart = function bubbleChart(parentDOMElement, rawData, rawEmotion) {
        /*
         * Main entry point to the bubble chart. This function is returned
         * by the parent closure. It prepares the rawData for visualization
         * and adds an svg element to the provided selector and starts the
         * visualization creation process.
         *
         * parentDOMElement is expected to be a DOM element or CSS selector that
         * points to the parent element of the bubble chart. Inside this
         * element, the code will add the SVG continer for the visualization.
         *
         * rawData is expected to be an array of data objects as provided by
         * a d3 loading function like d3.csv.
         */
        
        // Capture all the maximums and minimums in the numeric fields, which
        // will be used in any scatterplots.
        for (var numeric_field_index in BUBBLE_PARAMETERS.numeric_fields) {
            var numeric_field = BUBBLE_PARAMETERS.numeric_fields[numeric_field_index];
            dataExtents[numeric_field] = d3.extent(rawData, function (d) { return +d[numeric_field]; });
        }
        // Scale bubble radii using ^(0.5)
        // We size bubbles based on area instead of radius
        var maxRadius = dataExtents[BUBBLE_PARAMETERS.radius_field][1];
        radiusScale = d3.scalePow()
            .exponent(0.5)
            .range([10, 60])  // Range between 2 and 25 pixels
            .domain([0, maxRadius]);   // Domain between 0 and the largest bubble radius

        fillColorScale = getFillColorScale();
        
        // Initialize the "nodes" with the data we've loaded
        nodes = createNodes(rawData);

        emotion_data = loadEmotions(rawEmotion);

        // Initialize svg and inner_svg, which we will attach all our drawing objects to.
        createCanvas(parentDOMElement);

        // Create a container for the map before creating the bubbles
        // Then we will draw the map inside this container, so it will appear behind the bubbles
        inner_svg.append("g")
            .attr("class", "world_map_container");
        
        // Create the bubbles and the force holding them apart
        [all_nodes, nodes_data, init_sim] = createBubbles(nodes);
    };

    bubbleChart.switchMode = function (buttonID) {
        /*
         * Externally accessible function (this is attached to the
         * returned chart function). Allows the visualization to toggle
         * between display modes.
         *
         * buttonID is expected to be a string corresponding to one of the modes.
         */
        // Get data on the new mode we have just switched to
        currentMode = new ViewMode(buttonID, width, height);

        // Remove current labels
        inner_svg.selectAll('.bubble_group_label').remove();
        // Remove current debugging elements
        inner_svg.selectAll('.mc_debug').remove(); // DEBUG
        // Remove axes components
        inner_svg.selectAll('.axis').remove();
        // Remove map
        inner_svg.selectAll('.world_map').remove();

        // SHOW LABELS (if we have more than one category to label)
        if (currentMode.type == "grid" && currentMode.size > 1) {
            showLabels(currentMode);
        }
        // console.log(currentMode)

        // SHOW AXIS (if our mode is scatter plot)
        if (currentMode.type == "scatterplot") {
            xScale = d3.scaleLinear().range([0, width])
                .domain([dataExtents[currentMode.xDataField][0]*0.8, dataExtents[currentMode.xDataField][1]*1.1]);
            yScale = d3.scaleLinear().range([height, 0])
                .domain([dataExtents[currentMode.yDataField][0]*0.8, dataExtents[currentMode.yDataField][1]*1.1]);
            
            showAxis(currentMode);
        }
        // ADD FORCE LAYOUT
        if (currentMode.type == "scatterplot") {
            addForceLayout(true);  // make it static so we can plot bubbles
        } else {
            addForceLayout(false); // the bubbles should repel about the grid centers
        }

        // SHOW MAP (if our mode is "map")
        if (currentMode.type == "map") {
            var path = d3.geoPath().projection(bubbleMercProjection);

            d3.queue()
                .defer(d3.json, "data/world-110m2.json")
                .await(ready);

                function ready(error, topology) {
                  if (error) throw error;

                  inner_svg.selectAll(".world_map_container")
                    .append("g")
                    .attr("class", "world_map")
                    .selectAll("path")
                    .data(topojson.feature(topology, topology.objects.countries).features)
                    .enter()
                    .append("path")
                    .attr("d", path);
                }
        }
        
        // MOVE BUBBLES TO THEIR NEW LOCATIONS
        var targetFunction;
        if (currentMode.type == "grid") {
            targetFunction = getGridTargetFunction(currentMode);
        }
        if (currentMode.type == "scatterplot") {
            targetFunction = function (d) {
                return { 
                    x: xScale(d[currentMode.xDataField]),
                    y: yScale(d[currentMode.yDataField])
                };
            };
        }
        if (currentMode.type == "map") {
            targetFunction = function (d) {
                return {
                    x: bubbleMercProjection([+d.Longitude, +d.Latitude])[0],
                    y: bubbleMercProjection([+d.Longitude, +d.Latitude])[1]
                };
            };
        }
        
        // Given the mode we are in, obtain the node -> target mapping
        var targetForceX = d3.forceX(function(d) {return targetFunction(d).x})
            .strength(+BUBBLE_PARAMETERS.force_strength);
        var targetForceY = d3.forceY(function(d) {return targetFunction(d).y})
            .strength(+BUBBLE_PARAMETERS.force_strength);

        console.log(targetForceX)    
        // Specify the target of the force layout for each of the circles
        forceSim
            .force("x", targetForceX)
            .force("y", targetForceY);

        // Restart the force layout simulation
        forceSim.alphaTarget(1).restart();

        // if (currentMode.type == "grid") {
        //     addBubbleExpansion(all_nodes, nodes_data, targetFunction, init_sim);
        // }
    };
    
    // Return the bubbleChart function from closure.
    return bubbleChart;
}

/////////////////////////////////////////////////////////////////////////////////////
function ViewMode(button_id, width, height) {
    /* ViewMode: an object that has useful parameters for each view mode.
     * initialize it with your desired view mode, then use its parameters.
     * Attributes:
     - mode_index (which button was pressed)
     - buttonId     (which button was pressed)
     - gridDimensions    e.g. {"rows": 10, "columns": 20}
     - gridCenters       e.g. {"group1": {"x": 10, "y": 20}, ...}
     - dataField    (string)
     - labels       (an array)
     - type         (type of grouping: "grouping" or "scatterplot")
     - size         (number of groups)
     */
    // Find which button was pressed
    var mode_index;
    for(mode_index=0; mode_index<BUBBLE_PARAMETERS.modes.length; mode_index++) {
        if(BUBBLE_PARAMETERS.modes[mode_index].button_id == button_id) {
            break;
        }
    }
    if(mode_index>=BUBBLE_PARAMETERS.modes.length) {
        console.log("Error: can't find mode with button_id = ", button_id)
    }
    
    var curMode = BUBBLE_PARAMETERS.modes[mode_index];
    this.buttonId = curMode.button_id;
    this.type = curMode.type;
    
    if (this.type == "grid") {
        this.gridDimensions = curMode.grid_dimensions;
        this.labels = curMode.labels;
        if (this.labels == null) { this.labels = [""]; }
        this.dataField = curMode.data_field;
        this.size = this.labels.length;
        // Loop through all grid labels and assign the centre coordinates
        this.gridCenters = {};
        for(var i=0; i<this.size; i++) {
            var cur_row = Math.floor(i / this.gridDimensions.columns);    // indexed starting at zero
            var cur_col = i % this.gridDimensions.columns;    // indexed starting at zero
            var currentCenter = {
                x: (2 * cur_col + 1) * (width / (this.gridDimensions.columns * 2)),
                y: (2 * cur_row + 1) * (height / (this.gridDimensions.rows * 2))
            };
            this.gridCenters[this.labels[i]] = currentCenter;
        }
    }
    if (this.type == "scatterplot") {
        // Set up the x and y scales (domains need to be set using the actual data)
        this.xDataField = curMode.x_data_field;
        this.yDataField = curMode.y_data_field;
        this.xFormatString = curMode.x_format_string;
        this.yFormatString = curMode.y_format_string;
    }
    if (this.type == "map") {
        this.latitudeField = curMode.latitude_field;
        this.longitudeField = curMode.longitude_field;
    }
};


/////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////

// Set title
document.title = BUBBLE_PARAMETERS.report_title;
report_title.innerHTML = BUBBLE_PARAMETERS.report_title;
document.getElementById("report_title").style.color = BUBBLE_PARAMETERS.visa_blue;

// Create a new bubble chart instance
var myBubbleChart = createBubbleChart();

// Load data
// d3.csv("data/" + BUBBLE_PARAMETERS.data_file, function (error, data) {
//     // Once the data is loaded...
    
//     if (error) { console.log(error); }

//     // Display bubble chart inside the #vis div.
//     myBubbleChart('#vis', data);

//     // Start the visualization with the first button
//     myBubbleChart.switchMode(BUBBLE_PARAMETERS.modes[0].button_id)
// });

d3.queue()
.defer(d3.csv, "data/" + BUBBLE_PARAMETERS.data_file)
.defer(d3.csv, "data/" + BUBBLE_PARAMETERS.emotion_file)
.await(function (error, data, rawEmotion) {
    if (error) {console.log(error); }

    // Display bubble chart inside the #vis div.
    myBubbleChart('#vis', data, rawEmotion);

    // Start the visualization with the first button
    myBubbleChart.switchMode(BUBBLE_PARAMETERS.modes[0].button_id)    
})

function setupButtons() {
    // As the data is being loaded: setup buttons
    // Create the buttons
    // TODO: change this to use native d3js selection methods
    for (i = 0; i<BUBBLE_PARAMETERS.modes.length; i++) {
        var button_element = document.createElement("a");
        button_element.href = "#";
        if (i == 0) {
            button_element.className = "button active";
        } else {
            button_element.className = "button";
        }
        button_element.id = BUBBLE_PARAMETERS.modes[i].button_id;
        button_element.innerHTML = BUBBLE_PARAMETERS.modes[i].button_text;
        document.getElementById("toolbar").appendChild(button_element);
    }     

    // Handle button click
    // Set up the layout buttons to allow for toggling between view modes.
    d3.select('#toolbar')
        .selectAll('.button')
        .on('click', function () {
            // Remove active class from all buttons
            d3.selectAll('.button').classed('active', false);

            // Set the button just clicked to active
            d3.select(this).classed('active', true);

            // Get the id of the button
            var buttonId = d3.select(this).attr('id');

            // Switch the bubble chart to the mode of
            // the currently clicked button.
            myBubbleChart.switchMode(buttonId);
        });    
}

setupButtons();

/////////////////////////////////////////////////////////
/////////////// The Radar Chart Function ////////////////
/////////////// Written by Nadieh Bremer ////////////////
////////////////// VisualCinnamon.com ///////////////////
/////////// Inspired by the code of alangrafu ///////////
/////////////////////////////////////////////////////////
    
function RadarChart(id, data, options) {
    var cfg = {
     w: 600,                //Width of the circle
     h: 600,                //Height of the circle
     margin: {top: 20, right: 20, bottom: 20, left: 20}, //The margins of the SVG
     levels: 3,             //How many levels or inner circles should there be drawn
     maxValue: 0,           //What is the value that the biggest circle will represent
     labelFactor: 1.25,     //How much farther than the radius of the outer circle should the labels be placed
     wrapWidth: 60,         //The number of pixels after which a label needs to be given a new line
     opacityArea: 0.35,     //The opacity of the area of the blob
     dotRadius: 4,          //The size of the colored circles of each blog
     opacityCircles: 0.1,   //The opacity of the circles of each blob
     strokeWidth: 2,        //The width of the stroke around each blob
     roundStrokes: false,   //If true the area and stroke will follow a round path (cardinal-closed)
     color: d3.scaleOrdinal(d3.schemeCategory10),   //Color function
     prevRlines: [],        // Last Radar Line for showing transition on the lines
     prevCx: [],            // Last Circle Coordinate for showing transition on the dots
     prevCy: []             // Last Circle Coordinate for showing transition on the dots
    };
    
    //Put all of the options into a variable called cfg
    if('undefined' !== typeof options){
      for(var i in options){
        if('undefined' !== typeof options[i]){ cfg[i] = options[i]; }
      }//for i
    }//if
    
    //If the supplied maxValue is smaller than the actual one, replace by the max in the data
    var maxValue = Math.max(cfg.maxValue, d3.max(data, function(i){return d3.max(i.map(function(o){return o.value;}))}));
        
    var allAxis = (data[0].map(function(i, j){return i.axis})), //Names of each axis
        total = allAxis.length,                 //The number of different axes
        radius = Math.min(cfg.w/2, cfg.h/2),    //Radius of the outermost circle
        Format = d3.format(''),             //Percentage formatting
        angleSlice = Math.PI * 2 / total;       //The width in radians of each "slice"
    
    //Scale for the radius
    var rScale = d3.scaleLinear()
        .range([0, radius])
        .domain([0, maxValue]);
        
    /////////////////////////////////////////////////////////
    //////////// Create the container SVG and g /////////////
    /////////////////////////////////////////////////////////

    //Remove whatever chart with the same id/class was present before
    d3.select(id).select("svg").remove();
    
    //Initiate the radar chart SVG
    var svg = d3.select(id).append("svg")
            .attr("width",  cfg.w + cfg.margin.left + cfg.margin.right)
            .attr("height", cfg.h + cfg.margin.top + cfg.margin.bottom)
            .attr("class", "radar"+id);
    //Append a g element        
    var g = svg.append("g")
            .attr("transform", "translate(" + (cfg.w/2 + cfg.margin.left) + "," + (cfg.h/2 + cfg.margin.top) + ")");
    
    /////////////////////////////////////////////////////////
    ////////// Glow filter for some extra pizzazz ///////////
    /////////////////////////////////////////////////////////
    
    //Filter for the outside glow
    var filter = g.append('defs').append('filter').attr('id','glow'),
        feGaussianBlur = filter.append('feGaussianBlur').attr('stdDeviation','2.5').attr('result','coloredBlur'),
        feMerge = filter.append('feMerge'),
        feMergeNode_1 = feMerge.append('feMergeNode').attr('in','coloredBlur'),
        feMergeNode_2 = feMerge.append('feMergeNode').attr('in','SourceGraphic');

    /////////////////////////////////////////////////////////
    /////////////// Draw the Circular grid //////////////////
    /////////////////////////////////////////////////////////
    
    //Wrapper for the grid & axes
    var axisGrid = g.append("g").attr("class", "axisWrapper");
    
    //Draw the background circles
    axisGrid.selectAll(".levels")
       .data(d3.range(1,(cfg.levels+1)).reverse())
       .enter()
        .append("circle")
        .attr("class", "gridCircle")
        .attr("r", function(d, i){return radius/cfg.levels*d;})
        .style("fill", "#CDCDCD")
        .style("stroke", "#CDCDCD")
        .style("fill-opacity", cfg.opacityCircles)
        .style("filter" , "url(#glow)");

    //Text indicating at what % each level is
    axisGrid.selectAll(".axisLabel")
       .data(d3.range(1,(cfg.levels+1)).reverse())
       .enter().append("text")
       .attr("class", "axisLabel")
       .attr("x", 4)
       .attr("y", function(d){return -d*radius/cfg.levels;})
       .attr("dy", "0.4em")
       .style("font-size", "10px")
       .attr("fill", "#737373")
       .text(function(d,i) { return Format(maxValue * d/cfg.levels); });

    /////////////////////////////////////////////////////////
    //////////////////// Draw the axes //////////////////////
    /////////////////////////////////////////////////////////
    
    //Create the straight lines radiating outward from the center
    var axis = axisGrid.selectAll(".axis")
        .data(allAxis)
        .enter()
        .append("g")
        .attr("class", "axis");
    //Append the lines
    axis.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", function(d, i){ return rScale(maxValue*1.1) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("y2", function(d, i){ return rScale(maxValue*1.1) * Math.sin(angleSlice*i - Math.PI/2); })
        .attr("class", "line")
        .style("stroke", "white")
        .style("stroke-width", "2px");

    //Append the labels at each axis
    axis.append("text")
        .attr("class", "legend")
        .style("font-size", "11px")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", function(d, i){ return rScale(maxValue * cfg.labelFactor) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("y", function(d, i){ return rScale(maxValue * cfg.labelFactor) * Math.sin(angleSlice*i - Math.PI/2); })
        .text(function(d){return d})
        .call(wrap, cfg.wrapWidth);

    /////////////////////////////////////////////////////////
    ///////////// Draw the radar chart blobs ////////////////
    /////////////////////////////////////////////////////////
    
    //The radial line function
    var radarLine = d3.lineRadial()
        // .interpolate("linear-closed")
        .curve(d3.curveLinearClosed)
        .radius(function(d) { return rScale(d.value); })
        .angle(function(d,i) {  return i*angleSlice; });

    var radarLineMinus = d3.lineRadial()
        // .interpolate("linear-closed")
        .curve(d3.curveLinearClosed)
        .radius(function(d) { return rScale(d.value-1); })
        .angle(function(d,i) {  return i*angleSlice; });
        
    if(cfg.roundStrokes) {
        radarLine.curve(d3.curveCardinalClosed);
        radarLineMinus.curve(d3.curveCardinalClosed);
        // radarLine.interpolate("cardinal-closed");
    }
                
    //Create a wrapper for the blobs    
    var blobWrapper = g.selectAll(".radarWrapper")
        .data(data)
        .enter().append("g")
        .attr("class", "radarWrapper");

    //Append the backgrounds    
    blobWrapper
        .append("path")
        .attr("class", "radarArea")
        .attr("d", function(d,i) { return cfg.prevRlines.length? cfg.prevRlines[0]:radarLine(d); })
        .style("fill", function(d,i) { return cfg.color(i); })
        .style("fill-opacity", 0)
        .on('mouseover', function (d,i){
            //Dim all blobs
            d3.selectAll(".radarArea")
                .transition().duration(200)
                .style("fill-opacity", 0.1); 
            //Bring back the hovered over blob
            d3.select(this)
                .transition().duration(200)
                .style("fill-opacity", 0.7);    
        })
        .on('mouseout', function(){
            //Bring back all blobs
            d3.selectAll(".radarArea")
                .transition().duration(200)
                .style("fill-opacity", cfg.opacityArea);
        })
        .transition()
        .duration(1750)
        .attr('d', function(d,i) {return radarLine(d); })
        .style("fill", function(d,i) { return cfg.color(i); })
        .style("fill-opacity", cfg.opacityArea)
        ;
        
    //Create the outlines   
    blobWrapper.append("path")
        .attr("class", "radarStroke")
        .attr("d", function(d,i) { return cfg.prevRlines.length? cfg.prevRlines[0]:radarLine(d); })
        .style("stroke-width", cfg.strokeWidth + "px")
        .style("stroke", function(d,i) { return cfg.color(i); })
        .style("fill", "none")
        .style("filter" , "url(#glow)")
        .transition()
        .duration(1750)
        .attr('d', function(d,i) {return radarLine(d); });      
        
    //Append the circles
    blobWrapper.selectAll(".radarCircle")
        .data(function(d,i) { return d; })
        .enter().append("circle")
        .attr("class", "radarCircle")
        .attr("r", cfg.dotRadius)
        .attr("cx", function(d,i){ return cfg.prevCx.length? cfg.prevCx[i]: rScale(d.value) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("cy", function(d,i){ return cfg.prevCy.length? cfg.prevCy[i]: rScale(d.value) * Math.sin(angleSlice*i - Math.PI/2); })
        .style("fill", function(d,i,j) { return cfg.color(j); })
        .style("fill-opacity", 0.8)
        .transition()
        .duration(1750)
        .attr("cx", function(d,i){ return rScale(d.value) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("cy", function(d,i){ return rScale(d.value) * Math.sin(angleSlice*i - Math.PI/2); });

    /////////////////////////////////////////////////////////
    //////// Append invisible circles for tooltip ///////////
    /////////////////////////////////////////////////////////
    
    //Wrapper for the invisible circles on top
    var blobCircleWrapper = g.selectAll(".radarCircleWrapper")
        .data(data)
        .enter().append("g")
        .attr("class", "radarCircleWrapper");
        
    //Append a set of invisible circles on top for the mouseover pop-up
    blobCircleWrapper.selectAll(".radarInvisibleCircle")
        .data(function(d,i) { return d; })
        .enter().append("circle")
        .attr("class", "radarInvisibleCircle")
        .attr("r", cfg.dotRadius*1.5)
        .attr("cx", function(d,i){ return cfg.prevCx.length? cfg.prevCx[i]:rScale(d.value) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("cy", function(d,i){ return cfg.prevCx.length? cfg.prevCy[i]:rScale(d.value) * Math.sin(angleSlice*i - Math.PI/2); })
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", function(d,i) {
            newX =  parseFloat(d3.select(this).attr('cx')) - 10;
            newY =  parseFloat(d3.select(this).attr('cy')) - 10;
                    
            tooltip
                .attr('x', newX)
                .attr('y', newY)
                .text(Format(d.value))
                .transition().duration(200)
                .style('opacity', 1);
        })
        .on("mouseout", function(){
            tooltip.transition().duration(200)
                .style("opacity", 0);
        })
        .transition()
        .duration(1750)
        .attr("cx", function(d,i){ return rScale(d.value) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("cy", function(d,i){ return rScale(d.value) * Math.sin(angleSlice*i - Math.PI/2); });

    //Set up the small tooltip for when you hover over a circle
    var tooltip = g.append("text")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    /////////////////////////////////////////////////////////
    /////////////////// Helper Function /////////////////////
    /////////////////////////////////////////////////////////

    //Taken from http://bl.ocks.org/mbostock/7555321
    //Wraps SVG text    
    function wrap(text, width) {
      text.each(function() {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.4, // ems
            y = text.attr("y"),
            x = text.attr("x"),
            dy = parseFloat(text.attr("dy")),
            tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
            
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
        }
      });
    }//wrap     
}//RadarChart


/////////////////////////
// Radar Chart
/////////////////////////
var margin = {top: 80, right: 100, bottom: 80, left: 120},
width = Math.min(550, window.innerWidth - 10) - margin.left - margin.right,
height = Math.min(width, window.innerHeight - margin.top - margin.bottom - 20);
  
var color = d3.scaleOrdinal()
.range(["#EDC951","#CC333F","#00A0B0", "#66c2a5", "#6683c2", "#66c267", "#ba66c2", 
        "#c28c66", "#c26c66", "#bac266", "#666dc2"]);

var radarChartOptions = {
w: width,
h: height,
margin: margin,
maxValue: 5,
levels: 5,
roundStrokes: true,
color: color,
prevRlines: [],
prevCx: [],
prevCy: [],
};

// Load data
d3.csv("data/" + BUBBLE_PARAMETERS.emotion_file, function (error, rawData) {
    // Once the data is loaded...
    if (error) { console.log(error); }

    var emotion_data = rawData.map(function (data_row) { 
        emotion_row = []
        for(var key in data_row){

            if(key != "Index" && key!="Traveler Type" ) {
                emotion_row.push({axis: key, value: +data_row[key]})
            }
        }
        return emotion_row
    });

    d3.select('#inds')
      .on("change", function () {
        var sect = document.getElementById("inds");
        var section = sect.options[sect.selectedIndex].value;

        radar_data = [emotion_data[section]];
        radarChartOptions.color = d3.scaleOrdinal()
                                    .range([color(section)]);
        radarChartOptions.prevRlines = [d3.selectAll('.radarArea').attr('d')];  

        radarChartOptions.prevCx = []
        radarChartOptions.prevCy = []
        d3.selectAll('.radarCircle').each(function() {
          radarChartOptions.prevCx.push(d3.select(this).attr('cx'));
          radarChartOptions.prevCy.push(d3.select(this).attr('cy'));
        })

        RadarChart(".radarChart", radar_data, radarChartOptions);           
      });

    radarChartOptions.color = d3.scaleOrdinal()
                              .range([color(0)]);
    //Call function to draw the Radar chart
    RadarChart(".radarChart", [emotion_data[0]], radarChartOptions);
});



