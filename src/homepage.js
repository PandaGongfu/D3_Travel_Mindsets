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

        // GRIDLINES FOR DEBUGGING PURPOSES
        /*
        var grid_element_half_height = height / (mode.gridDimensions.rows * 2);
        var grid_element_half_width = width / (mode.gridDimensions.columns * 2);
        
        for (var key in currentMode.gridCenters) {
            if (currentMode.gridCenters.hasOwnProperty(key)) {
                var rectangle = inner_svg.append("rect")
                    .attr("class", "mc_debug")
                    .attr("x", currentMode.gridCenters[key].x - grid_element_half_width)
                    .attr("y", currentMode.gridCenters[key].y - grid_element_half_height)
                    .attr("width", grid_element_half_width*2)
                    .attr("height", grid_element_half_height*2)
                    .attr("stroke", "red")
                    .attr("fill", "none");
                var ellipse = inner_svg.append("ellipse")
                    .attr("class", "mc_debug")
                    .attr("cx", currentMode.gridCenters[key].x)
                    .attr("cy", currentMode.gridCenters[key].y)
                    .attr("rx", 15)
                    .attr("ry", 10);
            }
        }*/
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
        // Change the circle's outline to indicate hover state.
        // d3.select(this) 
        // .attr('stroke', BUBBLE_PARAMETERS.visa_blue)
        // .attr('stroke-width', 5);

        // Show the tooltip

        tooltip.showTooltip(tooltipContent(d), d3.event);
        // showRadarChart(d.Index>3 ? Math.floor(Math.random() * 4):d.Index);

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
        // .on('mouseover', showTooltip)
        // .on('mouseout', hideTooltip);        

        all_nodes = d3.selectAll('.node');

        // Color legend
        let colorScale = d3.scaleOrdinal()
            .domain(["Tier 1", "Tier 2", "Tier 3"])
            .range(["#ee3423", "#A9A9A9", "#ffebcd"] );
            // .range(["#7aa25c", "#beccae", "#d84b2a"] );
;

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
    //////////////////////////////////////////////////////////////
    
    var bubbleChart = function bubbleChart(parentDOMElement, rawData) {
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

// Set footer
// document.getElementById("footer_text").innerHTML = BUBBLE_PARAMETERS.footer_text;
// document.getElementById("footer_text").style.color = BUBBLE_PARAMETERS.visa_blue;
// document.getElementById("footer_text").style['font-weight'] = 'bold';

// Create a new bubble chart instance
var myBubbleChart = createBubbleChart();

// Load data
d3.csv("data/" + BUBBLE_PARAMETERS.data_file, function (error, data) {
    // Once the data is loaded...
    
    if (error) { console.log(error); }

    // Display bubble chart inside the #vis div.
    myBubbleChart('#vis', data);

    // Start the visualization with the first button
    myBubbleChart.switchMode(BUBBLE_PARAMETERS.modes[0].button_id)
});

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

// setupButtons();

