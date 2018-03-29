// Dimensions of sunburst.
var width = 700;
var height = 660;
var radius = Math.min(width, height) / 2;

var pathing_width = 1220;
var pathing_height = 660;
// Mapping of step names to colors.
var colors = {
  "Pre Booking": "#5687d1",
  "Pre Trip": "#7b615c",
  "En Route": "#de783b",
  "At Destination": "#6ab975",
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
          .attr("height", pathing_height)
          .attr("width", pathing_width)
          .append("g")

// Use d3.text and d3.csvParseRows so that we do not need to have a header
// row, and can receive the csv as an array of arrays.
d3.queue()
  .defer(d3.text, "data/phases_online.csv")
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

  var label_arr_t = ['','Pre Booking', '', '', 'At Destination']
  var label_arr_b = ['','', 'Pre Trip', 'En Route', '']

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
      .on("click", showPosts)
   ;

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
      .attr("dy", +120) //Move the text down
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
  // updateBreadcrumbs(sequenceArray, percentageString);

  // Fade all the segments.
  vis.selectAll("path")
      .style("opacity", 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  vis.selectAll("path")
      .filter(function(node) {
                return sequenceArray.length==1?(sequenceArray.indexOf(node) == 0):(sequenceArray.indexOf(node) == 1);
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


function showPosts(d) {
    d3.select('#pathing').selectAll(".titlebox")
      .style("opacity", 0);

    d3.select('#pathing').selectAll(".borderbox")
      .style("opacity", 0);

    d3.select('#pathing').selectAll(".bordertriangle")
      .style("opacity", 0);

    d3.select('#pathing').selectAll(".socialtxtbox")
      .style("opacity", 0);

    var top_pos = ['250px', '250px', '250px']
    var left_pos = ['800px', '1200px', '1600px']

    //fill box
    var border_x_pos = SOCIAL_BORDERS.x_pos;
    var border_y_pos = SOCIAL_BORDERS.y_pos;
    var border_width = SOCIAL_BORDERS.width;    
    var border_height = SOCIAL_BORDERS.height;
    var border_r = SOCIAL_BORDERS.r;
    var border_t_pos = SOCIAL_BORDERS.t_pos;

    var t_adj = [0, -400, -200];

    for (i=0; i<3; i++) {
      var txtbox = 
      d3.select('#curve')
      // svg_pathing
        .append('div')
        .attr('class', 'socialtxtbox')
        .style('top', top_pos[i])
        .style('left', left_pos[i])
        .style('opacity', 0.0)
        .html(SOCIAL_CONTENTS[d.data.name][i])
        .transition().duration(2000).ease(d3.easeExp)
        .style('opacity', 1.0);

      // borders  
      var borders = svg_pathing.selectAll('nodes')  
      .data(SOCIAL_BORDERS.height)
      .enter()
      .append('g')
      .attr('class', 'node');

      borders.append("rect")
      .attr('class','borderbox')
      .attr('x', function (d, j) {return border_x_pos[j]+400*i})
      .attr('y', function (d, j) {return border_y_pos[j]})
      .attr("height", function (d, j) {return border_height[j]})
      .attr("width", function (d, j) {return border_width[j]})
      .style("fill", "#FFD700")
      .style("stroke", "transparent")   
      .style('opacity', 0.0)
      .attr("rx", function (d, j) {return border_r[j]})
      .attr("ry", function (d, j) {return border_r[j]})
      .transition().duration(2300).ease(d3.easeExp)
      .style('opacity', 0.6);

      borders.append("polygon")
      .attr('class','bordertriangle')
      .attr('points', function (d, j) {
        var left = border_x_pos[j]+400*i+border_width[j];
        var top = border_t_pos[j]+border_y_pos[j]+t_adj[i];
        return left + ',' + top + ' '
            + left + ',' + (top+50) + ' '
            + (left+30) +','+(top+25);
      })
      .style("fill", "#FADA5E")
      // .style("fill","#FFD300")       
      .style('opacity', 0.0)
      .transition().duration(2300).ease(d3.easeExp)
      .style('opacity', 0.6);

    };

    // Title Boxes
    var title_top_pos = ['190px', '190px', '190px']
    var title_left_pos = ['875px', '1275px', '1675px']
    for (i=0; i<3; i++) {
      d3.select('#pathing')
        .append('div')
        .attr('class', 'titlebox')
        .style('top', title_top_pos[i])
        .style('left', title_left_pos[i])
        .style('opacity', 0.0)
        .style("stroke", "darkgrey")
        .html(SOCIAL_TITLES[d.data.name][i])
        .transition().duration(2000).ease(d3.easeExp)
        .style('opacity', 1.0);
    };

    // txt box
    // var box_contents = SOCIAL_CONTENTS[d.data.name]

    // var txtbox = svg_pathing.selectAll('socialtxtbox')  
    // .data(SOCIAL_TXTBOX.x_pos)
    // .enter()
    // .append('g')
    // .attr('class', 'node');

    // txtbox.append("rect")
    // .classed('socialtxtbox', true)
    // .attr('x', function (d) {return d})
    // .attr('y', function (d, j) {return SOCIAL_TXTBOX.y_pos[j]})
    // .attr("height", 600)
    // .attr("width", 300)
    // .style("fill", "transparent")   
    // .style('opacity', 0.2)
    // .attr("rx", 20)
    // .attr("ry", 20);

    // txtbox.append("text")
    // .attr('x', function (d) {return d})
    // .attr('y', function (d, j) {return 50+SOCIAL_TXTBOX.y_pos[j]})
    // .attr("dy", ".35em")
    // // .html(function(d, j) {return box_contents[j]});
    // .text(function(d, j) {return 'example'});
};




