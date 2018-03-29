// Dimensions of sunburst.
var width = 700;
var height = 650;
var radius = Math.min(width, height) / 2;

var pathing_width = 1200;

// Mapping of step names to colors.
var colors = {
  "Pre Booking (Offline)": "#5687d1",
  "Pre Trip (Offline)": "#7b615c",
  "En Route (Offline)": "#de783b",
  "At Destination (Offline)": "#6ab975",
  "Pre Booking (Online)": "#5687d1",
  "Pre Trip (Online)": "#7b615c",
  "En Route (Online)": "#de783b",
  "At Destination (Online)": "#6ab975",
  "Pre Booking (Combined)": "#5687d1",
  "Pre Trip (Combined)": "#7b615c",
  "En Route (Combined)": "#de783b",
  "At Destination (Combined)": "#6ab975",
};

// Total size of all segments; we set this later, after loading the data.
var totalSize = 0; 

var vis = d3.select("#chart").append("svg:svg")
    .attr("width", width)
    .attr("height", height)
    .append("svg:g")
    .attr("id", "container")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var partition = d3.partition()
    .size([2 * Math.PI, radius * radius]);

var arc = d3.arc()
    .startAngle(function(d) { return d.x0; })
    .endAngle(function(d) { return d.x1; })
    .innerRadius(function(d) { return Math.sqrt(d.y0); })
    .outerRadius(function(d) { return Math.sqrt(d.y1); });

var svg_pathing = d3.select("#curve")
          .append("svg")
          .attr("height", height)
          .attr("width", pathing_width)
          .append("g")

// Use d3.text and d3.csvParseRows so that we do not need to have a header
// row, and can receive the csv as an array of arrays.
d3.queue()
  .defer(d3.text, "data/phases_pathing.csv")
  .await(ready);

function ready(error, text) { 
  if (error) throw error;

  var csv = d3.csvParseRows(text);
  var json = buildHierarchy(csv);

  createVisualization(json);

};

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(json) {

  // Basic setup of page elements.
  // initializeBreadcrumbTrail();

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.

  vis.append("svg:circle")
      .attr("r", radius)
      .style("opacity", 0);

  // Turn the data into a d3 hierarchy and calculate the sums.
  var root = d3.hierarchy(json)
      .sum(function(d) { return d.size; })
      .sort(function(a, b) { return b.value - a.value; });
  
  // For efficiency, filter nodes to keep only those large enough to see.
  var nodes = partition(root).descendants()
      .filter(function(d) {
          return (d.x1 - d.x0 > 0.005); // 0.005 radians = 0.29 degrees
      });

  var label_arr_t = ['','','','','','','','','','Pre Booking', '', '', 'At Destination']
  var label_arr_b = ['','','','','','','','','','', 'Pre Trip', 'En Route', '']

  var path = vis.data([json]).selectAll(".phaseArc")
      .data(nodes)
      .enter().append("svg:path")
      .attr("class", "phaseArc")
      .attr("id", function(d,i) { return "phaseArc_"+i; })
      .attr("display", function(d) { return d.depth ? null : "none"; })
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
      .style("fill", function(d) { return colors[d.data.name]; })
      .style("opacity", 1)
      .on("mouseover", mouseover)
      .on("click", drawpathingline)
   ;

  console.log(path)

  vis.selectAll(".labelTextt")
      .data(label_arr_t)
      .enter().append("text")
      .attr("class", "labelTextt")
      .attr("x", 250) //Move the text from the start angle of the arc
      .attr("dy", -5) //Move the text down
      .append("textPath")
      .style("text-anchor","middle")
      .attr("xlink:href",function(d,i){return "#phaseArc_"+i;})
      .text(function(d){return d;});

  vis.selectAll(".labelTextb")
      .data(label_arr_b)
      .enter().append("text")
      .attr("class", "labelTextb")
      .attr("x", 250) //Move the text from the start angle of the arc
      .attr("dy", +80) //Move the text down
      .append("textPath")
      .attr("startOffset","50%")
      .style("text-anchor","middle")
      .attr("xlink:href",function(d,i){return "#phaseArc_"+i;})
      .text(function(d){return d;});

  // Add the mouseleave handler to the bounding circle.
  d3.select("#chart").on("mouseleave", mouseleave);
 };

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {
  d3.select("#percentage")
      .text(d.data.name);

  d3.select("#explanation")
      .style("visibility", "");

  var sequenceArray = d.ancestors().reverse();
  sequenceArray.shift(); // remove root node from the array

  // Fade all the segments.
  vis.selectAll("path")
      .style("opacity", 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  vis.selectAll("path")
      .filter(function(node) {
                return sequenceArray.length==1?(sequenceArray.indexOf(node) == 0):(sequenceArray.indexOf(node) == sequenceArray.length-1);
              })
      .style("opacity", 1);
}

// Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {
  // Deactivate all segments during transition.
  vis.selectAll("path").on("mouseover", null);

  // Transition each segment to full opacity and then reactivate it.
  vis.selectAll("path")
      .transition()
      .duration(750)
      .style("opacity", 1)
      .on("end", function() {
              d3.select(this).on("mouseover", mouseover);
            });

  d3.select("#explanation")
      .style("visibility", "hidden");
}

// Take a 2-column CSV and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how 
// often that sequence occurred.
function buildHierarchy(csv) {
  var root = {"name": "root", "children": []};
  for (var i = 0; i < csv.length; i++) {
    var sequence = csv[i][0];
    var size = +csv[i][1];
    if (isNaN(size)) { // e.g. if this is a header row
      continue;
    }
    var parts = sequence.split("-");
    var currentNode = root;
    for (var j = 0; j < parts.length; j++) {
      var children = currentNode["children"];
      var nodeName = parts[j];
      var childNode;
      if (j + 1 < parts.length) {
   // Not yet at the end of the sequence; move down the tree.
 	var foundChild = false;
 	for (var k = 0; k < children.length; k++) {
 	  if (children[k]["name"] == nodeName) {
 	    childNode = children[k];
 	    foundChild = true;
 	    break;
 	  }
 	}
  // If we don't already have a child node for this branch, create it.
 	if (!foundChild) {
 	  childNode = {"name": nodeName, "children": []};
 	  children.push(childNode);
 	}
 	currentNode = childNode;
      } else {
 	// Reached the end of the sequence; create a leaf node.
 	childNode = {"name": nodeName, "size": size};
 	children.push(childNode);
      }
    }
  }
  return root;
};

function drawpathingline(d) {
  console.log('drawpathingline')
  svg_pathing.selectAll("path")
      .style("opacity", 0);

  d3.select('#pathing').selectAll(".txtbox")
      .style("opacity", 0);

  d3.select('#pathing').selectAll(".node-icon")
      .style("opacity", 0);

  d3.select('#pathing').selectAll(".vertical_dash")
      .style("opacity", 0);

  var lineGenerator = d3.line()
  .curve(d3.curveCardinal);

  var points = [
    
    [100, 450],
    [200, 350],
    [300, 300],
    [400, 290],
    [500, 280],
    [600, 210],
    [700, 110],
    [800, 150],  
    [900, 250],
    [1000, 300],
    [1100, 300],
  ];
  var pathData = lineGenerator(points);

  var path = svg_pathing.append('path')
      .attr('d', pathData);

  var totalLength = path.node().getTotalLength();

  /***************** Create the required stroke-dasharray to animate a dashed pattern ****************/
  //Adjusted from http://stackoverflow.com/questions/24021971/animate-the-drawing-of-a-dashed-svg-line

  //Create a (random) dash pattern
  //The first number specifies the length of the visible part, the dash
  //The second number specifies the length of the invisible part
  var dashing = "10, 10"

  //This returns the length of adding all of the numbers in dashing (the length of one pattern in essense)
  //So for "6,6", for example, that would return 6+6 = 12
  var dashLength = 
    dashing
      .split(/[\s,]/)
      .map(function (a) { return parseFloat(a) || 0 })
      .reduce(function (a, b) { return a + b });
      
  //How many of these dash patterns will fit inside the entire path?
  var dashCount = Math.ceil( totalLength / dashLength );

  //Create an array that holds the pattern as often so it will fill the entire path
  var newDashes = new Array(dashCount).join( dashing + " " );
  //Then add one more dash pattern, namely with a visible part of length 0 (so nothing) and a white part
  //that is the same length as the entire path
  var dashArray = newDashes + " 0, " + totalLength;
  //Now offset the entire dash pattern, so only the last white section is 
  //visible and then decrease this offset in a transition to show the dashes
  path
      .attr("stroke-dashoffset", totalLength)
      .attr("stroke-dasharray", dashArray)  //This is where it differs with the solid line example
      .transition().duration(2000).ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

  // Add text boxes 
  var top_pos = ['620px', '500px', '470px', '330px', '470px', '500px']
  var left_pos = ['820px', '1030px', '1250px', '1410px', '1590px', '1800px']

  var img_top_pos = []

  var y_adj = [240, 160, 100, -30, 80, 100]

  for (i=0; i<6; i++) {
      d3.select('#pathing')
        .append('div')
        .attr('class', 'txtbox')
        .style('top', top_pos[i])
        .style('left', left_pos[i])
        .style('opacity', 0.0)
        .html(PATHING_CONTENTS.text_contents[d.data.name][i])
        .transition().duration(2000).ease(d3.easeExp)
        .style('opacity', 1.0);

      img_names = PATHING_CONTENTS.img_contents[d.data.name][i]

      var icons = svg_pathing.selectAll('images')  
        .data(img_names)
        .enter()
        .append('g')
        .attr('class', 'node');

      var img_height = 50
      var img_width = 75
      if (d.data.name.includes('Offline')) {
        img_height = 100
        img_width = 150
      };

      icons.append('image')
          .classed('node-icon', true)
          .attr('xlink:href', d => 'Img/'+ d + '.png')
          .attr('x', function (d, j) {return (PATHING_CONTENTS.x_pos[j]*2+1)/4*150+i*202})
          .attr('y', function (d, j) {return (PATHING_CONTENTS.y_pos[j]*2+1)/4*100+y_adj[i]})
          .attr('height', d => img_height)
          .attr('width', d => img_width)
          .style('opacity', 0.0)
          .transition().duration(2000).ease(d3.easeExp)
          .style('opacity', 1.0);

      if (d.data.name.includes('Combined')) {
        offline_data_name = d.data.name.replace('Combined', 'Offline')
        offline_img_names = PATHING_CONTENTS.img_contents[offline_data_name][i]
        var offline_icons = svg_pathing.selectAll('offline_images')  
        .data(offline_img_names)
        .enter()
        .append('g')
        .attr('class', 'node');
        var off_x_adj = [130, 130, 90, 150, 120, 120];
        var vertical_x_adj = [185, 185, 155, 200, 180, 180];
        var vertical_y = [325, 280, 200, 185, 300, 295];        

        offline_icons.append('image')
            .classed('node-icon', true)
            .attr('xlink:href', d => 'Img/'+ d + '.png')
            .attr('x', function (d, j) {return (PATHING_CONTENTS.x_pos[j]*2+1)/4*150+i*202+off_x_adj[i]})
            .attr('y', function (d, j) {return (PATHING_CONTENTS.y_pos[j]*2+1)/4*100})
            .attr('height', d => 70)
            .attr('width', d => 100)
            .style('opacity', 0.0)
            .transition().duration(2000).ease(d3.easeExp)
            .style('opacity', 1.0);

        offline_icons.append('line')
          .attr("class", "vertical_dash")
          .attr("x1", function (d, j) {return (PATHING_CONTENTS.x_pos[j]*2+1)/4*150+i*202+vertical_x_adj[i]})
          .attr("y1", function (d, j) {return vertical_y[i]})
          .attr("x2", function (d, j) {return (PATHING_CONTENTS.x_pos[j]*2+1)/4*150+i*202+vertical_x_adj[i]})
          .attr("y2", function (d, j) {return (PATHING_CONTENTS.y_pos[j]*2+1)/4*100+80})
          .style('opacity', 0.0)
          .transition().duration(2000).ease(d3.easeExp)
          .style('opacity', 1.0);

      }

    }
  };



