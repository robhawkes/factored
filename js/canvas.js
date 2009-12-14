/* 
 * Originally based on theory from http://dev.opera.com/articles/view/blob-sallad-canvas-tag-and-javascrip/
 */

/* Custom fade toggle plugin */
jQuery.fn.fadeToggle = function(speed, easing, callback) {
	return this.animate({opacity: 'toggle'}, speed, easing, callback);  
};

$(function() {
	var c = $('#canvas'); // Canvas element pointer
	var canvasWidth = $(window).width(); // Width of canvas
	var canvasHeight = $(window).height(); // Height of canvas
	var nodeColl; // Node collection pointer
	var gravity = new Vector(0.0, 0.0); // Global gravity vector
	var stopped; // Simulation playback boolean
	var savedMousePos = null; // Stored mouse position
	var selectOffset = null; // Distance between mouse click and node centre
	var ctx; // Canvas rendering context pointer
	var bound; // Canvas boundary object
	var debug; // Debug mode boolean
	var dt = 0.1; // Update time step value
	var orbit; // Orbit mode boolean
	var orbitAnim; // Orbit animation boolean
	var orbitAnimFinished = 0; // Orbit animation - counter of nodes completed animating
	var dataVisTog; // Data visuation toggle
	var factored; // FactoRED mode toggle
	
	/* Vector class */
	function Vector(x, y) {
		this.x = x; // X position of vector
		this.y = y; // Y position of vector
		
		/* Getters and setters */
		this.getX = function() {
			/* Return vector X position */
			return this.x;
		}	
		this.getY = function() {
			/* Return vector Y position */
			return this.y;
		}
		this.setX = function(x) {
			/* Set vector X position */
			this.x = x;
		}
		this.setY = function(y) {
			/* Set vector Y position */
			this.y = y;
		}
		
		this.addX = function(x) {
			/* Add to or remove from the vector X position */
			this.x += x;
		}		
		this.addY = function(y) {
			/* Add to or remove from the vector Y position */
			this.y += y;
		}
		
		this.set = function(x, y) {
			/* Set vector position */
			this.x = x; 
			this.y = y;
		}
	}
	
	/* Environment boundary class */
	function Boundary(x, y, w, h) {
		this.left = x; // X position of left edge
		this.right = w; // X position of right edge
		this.top = y; // Y position of top edge
		this.bottom = h; // Y position of bottom edge
		
		this.setBoundary = function(x, y, w, h) {
			/* Set position for left, right, top and bottom edges */
			this.left = x;
			this.right = w;
			this.top = y;
			this.bottom = h;
		}
		
		this.collision = function(cur) {
			var collide = false; // Collision detected
			var collideX = false; // Collision trigger on X axis
			var collideY = false; // Collision trigger on Y axis
			
			/* Node position is outside of the left boundary */
			if((cur.getCurX()-cur.getRealRadius()) < this.left) {
				/* Remove collision trigger on Y axis */
				//collideY = false;
				/* Move node back inside the boundary */
				cur.getCur().setX((this.left+cur.getRealRadius())); 
				/* Set collision triggers */
				collide = true;
				collideX = true;
			/* Node position is outside of the right boundary */
			} else if((cur.getCurX()+cur.getRealRadius()) > this.right) {
				/* Remove collision trigger on Y axis */
				//collideY = false;
				/* Move node back inside the boundary */
				cur.getCur().setX((this.right-cur.getRealRadius()));
				/* Set collision triggers */
				collide = true;
				collideX = true;
			}
			
			/* Node position is outside of the top boundary */
			if((cur.getCurY()-cur.getRealRadius()) < this.top) {
				/* Remove collision trigger on X axis */
				//collideX = false;
				/* Move node back inside the boundary */
				cur.getCur().setY((this.top+cur.getRealRadius())); 
				/* Set collision triggers */
				collide = true; 
				collideY = true;
			/* Node position is outside of the bottom boundary */
			} else if((cur.getCurY()+cur.getRealRadius()) > this.bottom) {
				/* Remove collision trigger on X axis */
				//collideX = false;
				/* Move node back inside the boundary */
				cur.getCur().setY((this.bottom-cur.getRealRadius())); 
				/* Set collision triggers */
				collide = true; 
				collideY = true;
			}
			
			return {collide: collide, x: collideX, y: collideY}; 
		}
	}
	
	/* Node data visualisation class */
	function DataVisualisation(x, y) {
		this.type = 'bar'; // Type of data visualisation: bar or circle
		this.values = new Array(); // Empty array for data values
		this.ori = new Vector(x, y); // Vector object of data vis origin position
		this.offset; // Offset, considering node radius, etc
		this.width = 10; // Size of data visualisation
		this.colour = {r: 200, g: 160, b: 115}; // Background colour
		
		this.getValues = function() {
			/* Return array of data values */
			return this.values;
		}
		this.setValues = function(values) {
			/* Set an array of data values */
			this.values = values;
		}
		this.addValue = function(value) {
			/* Add a value to the data array */
			this.values.push(value);
		}
		
		this.getOffset = function() {
			/* Return data vis offset */
			return this.offset;
		}
		this.setOffset = function(offset) {
			/* Set data vis offset */
			this.offset = offset;
		}
		
		this.getOri = function() {
			/* Return data vis origin position */
			return this.ori;
		}
		this.setOri = function(x, y) {
			/* Set data vis origin position */
			this.ori.x = x;
			this.ori.y = y;
		}
		
		this.setWidth = function(w) {
			/* Set size of data vis */
			this.width = w;
		}
		
		this.getColour = function() {
			/* Return data vis colour */
			return this.colour;
		}
		this.setColour = function (colour) {
			/* Set data vis colour */
			this.colour = colour;
		}
		
		this.draw = function() {			
			/* Set canvas to draw elements under anything there at the moment */
			ctx.globalCompositeOperation = 'destination-over';
			/* Set fill colour */
			ctx.fillStyle = 'rgb('+this.getColour().r+', '+this.getColour().g+', '+this.getColour().b+')';
			
			/* Data type is bars */
			if (this.type == 'bar') {
				var offsetX, offsetY;
				/* Value is negative */
				if (this.getValues()[0] < 0) {
					offsetX = this.offset*-1;
				/* Value is positive */
				} else {
					offsetX = this.offset;
				}
				/* Value is negative */
				if (this.getValues()[1] < 0) {
					offsetY = this.offset*-1;
				/* Value is positive */
				} else {
					offsetY = this.offset;
				}
				
				/* Draw filled bar on X axis */
				ctx.fillRect(Math.round(this.getOri().x), Math.round(this.getOri().y-(this.width/2)), this.getValues()[0]+offsetX, Math.round(this.width));
				/* Draw filled bar on Y axis */
				ctx.fillRect(Math.round(this.getOri().x-(this.width/2)), Math.round(this.getOri().y), Math.round(this.width), this.getValues()[1]+offsetY);
			/* Data type is something else */
			} else {
				
			}
			
			/* Set canvas to draw elements over anything there at the moment */
			ctx.globalCompositeOperation = 'source-over';
		}
	}
	
	/* Node class */
	function Node(x, y, data) {
		this.cur = new Vector(x, y); // Vector object of node current position
		this.prev = new Vector(x, y); // Vector object of node previous position
		
		this.zIndex = 0.2+(Math.random()*0.8); // Z index: 1 = normal size
		this.prevZIndex; // Previous Z index
		
		this.radius = 60; // Radius
		this.prevRadius; // Previous radius
		this.realRadius = this.radius*this.zIndex; // Radius in relation to Z position
		
		this.mass = 1.0; // Mass
		this.force = new Vector(0.0, 0.0); // Vector object of force affecting node
		this.friction = Math.random()*0.1; // Friction affecting node
		this.velocity; // Current velocity
		
		this.selected = false; // Selected toggle
		
		this.colour = {r: Math.round(Math.random()*200), g: Math.round(Math.random()*200), b: Math.round(Math.random()*200)}; // Node background colour
		
		this.nearest; // Pointer to nearest node
		this.dataVis = new Array(); // Empty array for data visualisations
		this.data = data; // Node data
		
		/* Combine orbit toggles into an object / array to reduce all these variables? */
		this.orbitPos; // Node position in orbit
		this.orbitFinished; // Node orbit animation status
		
		this.setSelected = function(selected) {
			/* Toggle node as selected (true or false) */
			this.selected = selected;
		}
		
		this.getCurX = function() {
			/* Return node current X position */
			return this.cur.getX();
		}	
		this.getCurY = function() {
			/* Return node current Y position */
			return this.cur.getY();
		}	
		this.getCur = function() {
			/* Return node current position */
			return this.cur;
		}
		this.setCur = function(x, y) {
			/* Set node current position */
			this.cur.set(x, y);
		}
		this.getPrevX = function() {
			/* Return node previous X position */
			return this.prev.getX();
		}	
		this.getPrevY = function() {
			/* Return node previous Y position */
			return this.prev.getY();
		}	
		this.getPrev = function() {
			/* Return node previous position */
			return this.prev;
		}		
		this.setPrev = function(x, y) {
			/* Set node previous position */
			/* Useful for manipulating node velocity */
			this.prev.set(x, y);
		}

		this.getZIndex = function() {
			/* Return node Z index */
			return this.zIndex;
		}
		this.setZIndex = function(index) {
			/* Set node current Z index as previous Z index */
			this.prevZIndex = this.zIndex;
			/* Set node current Z index */
			this.zIndex = index;
		}
		
		this.getRadius = function() {
			/* Return node radius */
			return this.radius;
		}
		this.setRadius = function(radius) {
			/* Set current radius as previous radius */
			this.prevRadius = this.radius;
			/* Set current radius */
			this.radius = radius;
		}
		this.getRealRadius = function() {
			/* Return radius in relation to Z index */
			return this.realRadius;
		}
		this.setRealRadius = function() {
			/* Set radius in relation to Z index */
			this.realRadius = this.radius*this.zIndex;
		}
		
		this.getMass = function() {
			/* Return node mass */
			return this.mass;
		}
		this.setMass = function(mass) {
			/* Set node mass */
			this.mass = mass;
		}
		this.setForce = function(x, y) {
			/* Set node force */
			this.force.set(x, y); 
		}    
		this.setForceX = function(x) {
			/* Set node X force */
			this.force.setX(x);
		}
		this.setForceY = function(y) {
			/* Set node Y force */
			this.force.setY(y);
		}
		this.setFriction = function(friction) {
			/* Set node friction */
			this.friction = friction;
		}
		this.getVelocity = function() {
			return this.velocity;
		}
		this.getVelocityX = function() {
			/* Return node X velocity */
			return this.cur.getX() - this.prev.getX();
		}	
		this.getVelocityY = function() {
			/* Return node Y velocity */
			return this.cur.getY() - this.prev.getY();
		}
		this.setVelocity = function() {
			var cXpX, cYpY; 
			
			/* Calculate difference in node current and previous positions */
			cXpX = this.cur.getX() - this.prev.getX(); 
			cYpY = this.cur.getY() - this.prev.getY();
			
			/* Store in a node variable so only calculating velocity once per cycle */
			this.velocity = cXpX * cXpX + cYpY * cYpY;			
		}
			
		this.getColour = function() {
			/* Return node colour */
			return this.colour;
		}		
		this.setColour = function(colour) {
			/* Set node colour */
			this.colour = colour;
		}
		this.setColourRand = function() {
			/* Randomise node colour */
			this.colour = {r: Math.round(Math.random()*200), g: Math.round(Math.random()*200), b: Math.round(Math.random()*200)}
		}
		this.slideColour = function() {
			/* Slowly randomise node colour */
			this.colour = {r: this.getColour().r+(Math.round(Math.random()*10)-5), g: this.getColour().g+(Math.round(Math.random()*10)-5), b: this.getColour().b+(Math.round(Math.random()*10)-5)};
		}
		this.setColourR = function(r) {
			/* Set node red colour */
			this.colour.r = r;
		}
		this.setColourG = function(g) {
			/* Set node green colour */
			this.colour.g = g;
		}
		this.setColourB = function(b) {
			/* Set node blue colour */
			this.colour.b = b;
		}
		
		this.newDataVis = function() {
			/* Add a new data visualisation object to node at current position */
			var dL = this.dataVis.push(new DataVisualisation(this.getCurX(), this.getCurY()));
			/* Set values of data vis to that of the node velocity */
			this.dataVis[dL-1].setValues([this.getVelocityX()*5, this.getVelocityY()*5]);
			/* Set data vis offset to node real radius */
			this.dataVis[dL-1].setOffset(this.getRealRadius());
			/* Set width of data vis to 1/2 of the node real radius */
			this.dataVis[dL-1].setWidth(this.getRealRadius()/2);
			/* Set colour of data vis to same as node background */
			this.dataVis[dL-1].setColour(this.getColour());
		}
		this.removeDataVis = function() {
			/* Clear data vis array */
			this.dataVis = [];
		}
		
		this.move = function(dt) {
			/* Node is not static */
			if (!this.static) {
				/* dt = time step (change in time) */
				
				/* Current node position */
				var c;
				/* New node position */
				var t;
				/* Force to apply - acceleration */
				var a;
				/* Change in time squared */
				var dtdt; 
				
				/* Calculate time step squared */
				dtdt = dt * dt; 
				
				/* Move in x direction */
				/* Calculate acceleration to apply via Newton's second law */
				a = this.force.getX()/this.mass;
				/* Current node position */
				c = this.cur.getX();
				/* Calculate new node position via Verlet integration */
				t = (2.0 - this.friction) * c - (1.0 - this.friction) * this.prev.getX() + a * dtdt;
				
				/* Set previous x position */
				this.prev.setX(c); 
				/* Set new x position */
				this.cur.setX(t);
				    
				/* Move in y direction - essentially same method as with x direction */
				a = this.force.getY() / this.mass;
				c = this.cur.getY(); 
				t = (2.0 - this.friction) * c - (1.0 - this.friction) * this.prev.getY() + a * dtdt;
				this.prev.setY(c); 
				this.cur.setY(t);
				
				/* Loop through data visualisations if they exist */
				var dataVisLength = this.dataVis.length; // Store data vis length to save unnecessary calls
				if (dataVisLength > 0) {
					for (var i = 0; i < dataVisLength; i++) {
						var dataVis = this.dataVis[i]; // Store data vis pointer to save unnecessary calls
						
						/* Data vis is empty */
						if (dataVis == null)
							continue;
						
						/* Update data vis position */
						dataVis.setOri(this.getCurX(), this.getCurY());
						/* Update data vis values */
						dataVis.setValues([this.getVelocityX()*5, this.getVelocityY()*5]);
						/* Update data vis offset */
						dataVis.setOffset(this.getRealRadius());
						/* Update data vis width */
						dataVis.setWidth(this.getRealRadius()/2);
					}
				}
			}
		}
		
		/* Manual control */
		this.moveTo = function(x, y) {
			/* Set pointer to current node position */
			var nodePos = this.getCur();
			/* Calculate difference in node position */
			x -= nodePos.getX();
			y -= nodePos.getY();
			
			/* Change node position */
			nodePos.addX(x);
			nodePos.addY(y);
		}
		this.open = function(x, y) {
			/* Set node current position to centre of canvas */
			this.setCur(canvasWidth/2, canvasHeight/2);
			/* Set node Z index to 1 to enable full size */
			this.setZIndex(1);
			/* Set radius to something prominent */
			this.setRadius(180);
			/* Grab data overlay element */
			var dataEl = $('.data');
			/* Load node data into overlay */
			dataEl.html(this.data);
			/* Update height of data overlay */
			var dataHeight = dataEl.height();
			/* Vertically centre data overlay */
			dataEl.css({marginTop: '-'+dataHeight/2+'px'});
		}
		this.close = function() {
			/* Clear data overlay */
			$('.data').html('');
			/* Reset node Z index */
			this.setZIndex(this.prevZIndex);
			/* Reset node radius */
			this.setRadius(this.prevRadius);
		}
		
		this.checkCollision = function(bound) {
			/* Calculate result of collision check */ 
			var collision = bound.collision(this);
			/* Node has collided with a boundary edge */
			if (collision.collide) {
				/* Collided on X axis */	
				if (collision.x) {
					/* Reverse node X velocity */
					this.prev.setX(this.cur.getX()+this.getVelocityX()); // Increase velocity to spring from edge
				/* Collided on Y axis */
				} else if (collision.y) {
					/* Reverse node Y velocity */
					this.prev.setY(this.cur.getY()+this.getVelocityY()); // Increase velocity to spring from edge
				}
				
				/* Randomise node colour */
				this.setColourRand();
				//this.slideColour();
			}		
		}
		
		this.draw = function(index) {
			/* Update node real radius */
			this.setRealRadius();
			
			/* Node is not selected */
			if (!this.selected) {
				/* Set shadow blur */
				ctx.shadowBlur = 0;
				/* Set shadow colour */
				ctx.shadowColor = 'rgba(0, 0, 0, 0)'; // Transparent black
				
				/* Loop through data visualisations if they exist */
				var dataVisLength = this.dataVis.length; // Store data vis length to save unnecessary calls
				if (dataVisLength > 0) {
					for (var i = 0; i < dataVisLength; i++) {
						var dataVis = this.dataVis[i]; // Store data vis pointer to save unnecessary calls
						
						/* Data vis is empty */
						if (dataVis == null)
							continue;
					
						/* Set colour of data visualisations */
						dataVis.setColour(this.getColour());
						/* Run data visualisation draw method */
						dataVis.draw();
					}
				}
				
				/* Set canvas to draw elements under anything there at the moment */
				ctx.globalCompositeOperation = 'destination-over';
			/* Node is selected */
			} else {
				/* Set fill colour as 1/2 transparent black */
				ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
				/* Set canvas to draw elements over anything there at the moment */
				ctx.globalCompositeOperation = 'source-over';
				/* Draw a rectangle overlay over canvas */
				ctx.fillRect(0, 0, canvasWidth, canvasHeight);
				/* Safari has an issue with this blur & it has a significant performance hit on others */
				//ctx.shadowBlur = 500;
				//ctx.shadowColor = 'rgba(0, 0, 0, 1)'; // Solid black
			}
			
			/* Set nodes colour */	
			ctx.fillStyle = 'rgb('+this.colour.r+', '+this.colour.g+', '+this.colour.b+')';
			
			/* Draw node on canvas */
			ctx.beginPath();
			ctx.arc(this.getCurX(), this.getCurY(), this.getRealRadius(), 0, Math.PI*2, true);
			
			/* Fill node */
			ctx.fill();
			
			/* Node border */
			ctx.beginPath();
			ctx.fillStyle = 'rgb('+(this.colour.r-50)+', '+(this.colour.g-50)+', '+(this.colour.b-50)+')';
			ctx.arc(this.getCurX(), this.getCurY(), this.getRealRadius()+1, 0, Math.PI*2, true);
			ctx.fill();
			
			/* Debug mode is enabled */
			if (debug) {
				/* Set canvas to draw elements over anything there at the moment */
				ctx.globalCompositeOperation = 'source-over';
				/* Set text colour */
				ctx.fillStyle = 'rgb(0, 0, 0)';
				/* Set text alignment */
				ctx.textAlign = 'center';
				
				/* Draw text */
				ctx.fillText('vX: '+this.getVelocityX().toFixed(2), this.getCurX(), this.getCurY()-5);
				ctx.fillText('vY: '+this.getVelocityY().toFixed(2), this.getCurX(), this.getCurY()+5);
				ctx.fillText(index+':'+this.nearest, this.getCurX(), this.getCurY()+15);
				
				/* Set canvas to draw elements under anything there at the moment */
				ctx.globalCompositeOperation = 'destination-over';
			}
		}
	}
	
	/* Node collection class */
	function NodeCollection() {
		this.nodes = new Array(); // Empty array to store nodes
		this.selectedNode = null; // Pointer to selected node
		
		this.newNode = function(x, y, data) {
			/* Add node object to the nodes array */
			this.nodes.push(new Node(x, y, data));
		}	
		this.selectNode = function(x, y) {
			var selectOffset = null;
			
			/* Node is empty */
			if (this.selectedNode != null) {
				/* Exit out of method */
				return;
			}
			
			/* Loop through nodes */
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Check if there node still exists */
				if (node == null)
					continue;
				
				/* Current position of node */
				nodeCur = node.getCur();
				/* Difference between mouse x and node x */
				var aXbX = x - nodeCur.getX();
				/* Difference between mouse y and node y */
				var aYbY = y - nodeCur.getY();
				/* Distance between mouse and node */
				var dist = Math.round(Math.sqrt(Math.pow(x-nodeCur.getX(),2) + Math.pow(y-nodeCur.getY(),2)));
				
				/* Clickable fringe around node */
				//var fringe = (this.nodes[i].getRadius() < 20) ? 5 : 0;
				var fringe = 3;
				
				/* Check if we're clicking within the bounds of the node + fringe */
				if (dist < (node.getRadius()*node.getZIndex()) + fringe) {
					/* Set selectedNode as reference to current node */
					this.selectedNode = node;
					/* Set selectOffset as xy difference between mouse and node */
					selectOffset = {x:aXbX, y:aYbY};
				}
				
				/* Exit loop if a node has been selected? */
			}
			
			/* Check if a node has been selected */
			if (this.selectedNode != null) {
				/* Set node as selected */
				this.selectedNode.setSelected(true);
			}
			
			/* Return mouse offset */
			return selectOffset;
		}	
		this.unselectNode = function() {
			/* No nodes selected */
			if (this.selectedNode == null)
				return;
			
			/* Set node as unselected */
			this.selectedNode.setSelected(false);
			/* Remove node reference from selectedNode */
			this.selectedNode = null;
		}	
		this.setForce = function(x, y) {
			/* Loop through nodes */
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Node is empty */
				if (node == null)
					continue;
									
				/* Node is selected */
				if(node == this.selectedNode) {
					/* Set force to 0 so node is stationery */
					node.setForce(0.0, 0.0); 
					continue; 
				}
				
				/* Set new force */
				node.setForce(x, y); 
			}
		}	
		
		/* Increase peformance of this function - it's a killer! */
		this.findNearest = function(excludeIndex) {
			var minDist = 100; // Minimum distance to look for closest node 
			var foundIndex; // Index of nearest node
			var oriDist; // Distance between node origins
			var dist; // Distance between node edges
			var curNode; // Current node
			var checkNode; // Checked node
			var permimeter; // Perimeter around current node
			var curColour; // Colour of current node
			var checkColour; // Colour of checked node
			
			/* Store pointer to current node */
			curNode = this.nodes[excludeIndex];
			/* Store perimeter around current node */
			perimeter = curNode.getRealRadius();
			
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Node is excluded or is empty */
				if(i == excludeIndex || node == null)
					continue;
				
				/* Store pointer to checked node */
				checkNode = node;
				/* Store node colours */
				curColour = curNode.getColour();
				checkColour = checkNode.getColour();
				
				/* Current node is not static */
				if (!curNode.static) {
					/* Calculate distance between node origins */
					oriDist = Math.round(Math.sqrt(Math.pow(curNode.getCurX()-checkNode.getCurX(),2) + Math.pow(curNode.getCurY()-checkNode.getCurY(),2)));
					/* Calculate distance between node edges */
					dist = oriDist-Math.round(curNode.getRealRadius()+checkNode.getRealRadius());
					
					/* Nodes are closer than the minimum distance */
					if (dist < minDist) {
						/* Reduce minimum distance to the distance between nodes */
						minDist = dist;
						/* Set index of nearest node */
						foundIndex = i;
					}
					
					/* Checked node is inside perimeter and not touching the current node */
					if (dist < perimeter && dist > 0) {
						/* Current node is smaller than the checked node */
						if (curNode.getRealRadius() < checkNode.getRealRadius()) {
							/* Current node is a different colour to the checked node */
							if (curColour != checkColour) {
								/* Checked node isn't static */
								if (!checkNode.static) {
									/* Current node red value is greater than the check node */
									if (curNode.getColour().r > checkNode.getColour().r) {
										/* Reduce the current node red value */
										curNode.setColourR(curNode.getColour().r-5);
									/* Current node red value is less than the check node */
									} else if (curNode.getColour().r < checkNode.getColour().r) {
										/* Increase the current node red value */
										curNode.setColourR(curNode.getColour().r+5);
									}
									
									/* Current node green value is greater than the check node */
									if (curNode.getColour().g > checkNode.getColour().g) {
										/* Reduce the current node green value */
										curNode.setColourG(curNode.getColour().g-5);
									/* Current node green value is less than the check node */
									} else if (curNode.getColour().g < checkNode.getColour().g) {
										/* Increase the current node green value */
										curNode.setColourG(curNode.getColour().g+5);
									}
									
									/* Current node blue value is greater than the check node */
									if (curNode.getColour().b > checkNode.getColour().b) {
										/* Reduce the current node blue value */
										curNode.setColourB(curNode.getColour().b-5);
									/* Current node blue value is less than the check node */
									} else if (curNode.getColour().b < checkNode.getColour().b) {
										/* Increase the current node blue value */
										curNode.setColourB(curNode.getColour().b+5);
									}
								}
							/* Current node is larger than or equal in size to the checked node */								
							} else {
								
							}					
						}
					/* Checked node is outside the perimeter */
					} else if (dist >= perimeter) {
						
					}
					
					/* Checked node is inside the perimter and possibly inside the node diameter as well */
					if (dist < perimeter) {
						/* Set forces to repel different nodes */
						/* Tweak this so big nodes can't pin smaller ones into a corner */
						/* Current node is smaller than checked node */
						//if (curNode.getRealRadius() < checkNode.getRealRadius()) {
							/* Current node is a different colour to the checked node */
						//	if (curColour != checkColour) {
								/* Current node is to the left of checked node */
						//		if (curNode.getCurX() < checkNode.getCurX()) {
									/* Set a negative force to move current node left */
						//			curNode.setForceX(-5);
								/* Current node is to the right of checked node */
						//		} else {
									/* Set a positive force to move current node right */
						//			curNode.setForceX(5);
						//		}
								
								/* Current node is above checked node */
						//		if (curNode.getCurY() < checkNode.getCurY()) {
									/* Set a negative force to move current node up */
						//			curNode.setForceY(-5);
								/* Current node is below checked node*/
						//		} else {
									/* Set a positive force to move current node down */
						//			curNode.setForceY(5);
						//		}
						//	}
						//}
					}
					
					/* Checked node is within the diameter of the current node and isn't static */
					if (Math.round(dist) <= 0 && !checkNode.static) {
						/* Current node is smaller than the checked node */
						if (curNode.getRealRadius() < checkNode.getRealRadius()) {
							/* Current node is a different colour to the checked node */
							if (curColour != checkColour) {
								/* Change colour of current node to the colour of checked node */
								curNode.setColour(checkColour);
							}
						}
					}
				}
			}
			
			/* Store index of nearest node */
			curNode.nearest = foundIndex;
			
			/* Return index of nearest node */
			return foundIndex;
		}	

		this.addDataVis = function() {
			/* Loop through nodes */
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Check if there node still exists */
				if (node == null)
					continue;
					
				/* Create a new data visualisation */
				node.newDataVis();
			}
		}
		this.removeDataVis = function() {
			/* Loop through nodes */
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Check if there node still exists */
				if (node == null)
					continue;
					
				/* Remove data visualisation */
				node.removeDataVis();
			}			
		}
		
		this.move = function(dt) {	
			/* Loop through nodes */
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Check if there node still exists */
				if (node == null)
					continue;
				
				/* Run node move method */
				node.move(dt); 
			}
		}

		/* Manual control */
		this.selectedNodeMoveTo = function(x, y) {
			/* No nodes selected */
			if (this.selectedNode == null)
				return;
			
			/* Set new coords for node */
			this.selectedNode.moveTo(x, y);
		}
		this.selectedNodeOpen = function() {
			/* No node selected */
			if (this.selectedNode == null)
				return;
			
			/* Open selected node */
			this.selectedNode.open();
		}
		this.selectedNodeClose = function() {
			/* No node selected */
			if (this.selectedNode == null)
				return;
			
			/* Close selected node */
			this.selectedNode.close();
		}

		this.nextNodeOpen = function(direction) {
			var nodeLength, curNode, selectedNode;

			/* A node is selected */
			if (this.selectedNode) {				
				/* Loop through nodes */
				var nodeLength = this.nodes.length; // Store nodes length to save unnecessary calls
				for (var i = 0; i < nodeLength; i++) {
					var node = this.nodes[i]; // Store node pointer to save unnecessary calls
					
					/* Node is empty */
					if (node == null)
						continue; // Move to next iteration
					
					/* Node is selected */
					if (node.selected) {
						selectedNode = i;
						break;
					}
				}
				
				
				/* Set selected node force to push it away when closed and orbit mode is quit */ 
				this.selectedNode.setForce(Math.round(Math.random()*1000)-500, Math.round(Math.random()*1000)-500);
				/* Close selected node */
				this.selectedNodeClose();
				/* Unselect selected node */
				this.unselectNode();
				/* Reset mouse and offset data */
				savedMousePos = null;
				selectOffset = null;
				
				/* Turn off orbit mode */
				disableOrbit();
			}
				
			/* Set index direction for next/prev node */
			var index = (!direction) ? 1 : -1;
			
			/* Beginning or end of node array */	
			if (selectedNode+index < 0 || selectedNode+index == nodeLength) {				
				/* Heading clockwise (increasing index) */
				if (index > 0) {
					/* Set selected node to first node */
					this.selectedNode = this.nodes[0];					
				/* Heading anti-clockwise (decreasing index) */
				} else {
					/* Set selected node to last node */
					this.selectedNode = this.nodes[nodeLength-1];					
				}
			/* Mid node array */					
			} else {
				/* Set selected node to next/previous */
				this.selectedNode = this.nodes[selectedNode+index];
			}
			
			/* Set that node as selected */
			this.selectedNode.setSelected(true);
			/* Turn on orbit mode */
			enableOrbit();
			/* Open selected node */
			this.selectedNodeOpen();
		}
			
		this.checkCollision = function(bound) {
			/* Loop through nodes */
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Check if there node still exists */
				if (node == null)
					continue;
					
				/* Check if node has collided with boundary */
				node.checkCollision(bound);
			}
		}
				
		this.draw = function() {
			/* Loop through nodes */
			var nodesLength = this.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = this.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Check if there node still exists */
				if (node == null)
					continue;
					
				/* Run node draw method and pass index */
				this.nodes[i].draw(i);
			}
		}
	}
	
	/* Global update function - run on each timeout() iteration */
	function update() {
		/* Not in orbit mode */
		if (!orbit) {
			/* Run node collection move method */
			nodeColl.move(dt);
			
			/* Boundary exists */
			if (bound) {
				/* Check for any collisions with the boundary */
				nodeColl.checkCollision(bound);
			}
			
			/* Loop through nodes */
			var nodesLength = nodeColl.nodes.length; // Store nodes length to save unnecessary calls
			for (var i = 0; i < nodesLength; i++) {
				var node = nodeColl.nodes[i]; // Store node pointer to save unnecessary calls
				
				/* Check if there node still exists */
				if (node == null)
					continue;
				
				/* Reset radius after orbit mode */
				if (node.getRadius() < 50) {
					node.setRadius(nodeColl.nodes[i].getRadius()+10);
				} else if (node.getRadius() >= 50 && node.getRadius() < 60) {
					node.setRadius(60);
				}
				
				/* Add springy edges to help stop nodes getting stuck */
				/* Node is under 61 pixels from the left edge */
				if (node.getCurX() < 61) {
					var forceX = 20;
				/* Node is 61 pixels from the right edge */					
				} else if (node.getCurX() > canvasWidth-61) {
					var forceX = -20;
				/* Node isn't near left or right edge */				
				} else {
					/* Random force between -15 and 15 */
					var forceX = (Math.random()*30)-15;					
				}
				/* Node is under 61 pixels from the top edge */
				if (node.getCurY() < 61) {
					var forceY = 20;
				/* Node is under 61 pixels from the bottom edge */
				} else if (node.getCurY() > canvasHeight-61) {
					var forceY = -20;
				/* Node isn't near top or bottom edge */
				} else {
					/* Random force between -15 and 15 */
					var forceY = (Math.random()*30)-15;					
				}
				
				/* Set node forces */
				node.setForceX(forceX);
				node.setForceY(forceY);
				
				/* Find nearest nodes to current node and run proximity related code */
				/* Increase peformance of this function - it's a killer! */
				nodeColl.findNearest(i);
			}
		/* In obit mode */
		} else {
			var nodes, nodeLength;
			nodes = nodeColl.nodes;
			nodeLength = nodes.length;

			/* Some nodes still have unfinished orbit animations */
			if (orbitAnimFinished <= nodeLength-1) {
				/* Main orbit animation is disabled */
				if (!orbitAnim) {
					var x, y, angle, curNode;
					/* Angle for each node around orbit perimeter */
					angle = 360/nodeLength;
					
					/* Loop through nodes */
					for (var i = 0; i < nodeLength; i++) {
						curNode = nodes[i];
						
						/* Current node is empty */
						if (curNode == null)
							continue; // Move to next iteration
						
						/* Calculate position of node on orbit perimeter */
						x = canvasWidth/2+(250*Math.cos((i*angle)*Math.PI/180));
						y = canvasHeight/2+(250*Math.sin((i*angle)*Math.PI/180));
						
						/* Create vector object and store node orbit position */
						curNode.orbitPos = new Vector(x, y);
					}
					
					/* Set orbit animation in motion */
					orbitAnim = true;
				/* Main orbit animation is enabled */
				} else {
					var dist, x, y;
					var orbitRadius = 13;
					var orbitRadiusStep = 10;
					var orbitAnimationStep = 110;
					/* Loop through nodes */
					for (var i = 0; i < nodeLength; i++) {
						curNode = nodes[i];
						
						/* Current node is empty */
						if (curNode == null)
							continue; // Move to next iteration
						
						/* Node isn't selected */
						if (!curNode.selected) {
							/* Radius is larger than desired orbit radius + orbit radius step */
							if (curNode.getRadius() > orbitRadius+orbitRadiusStep) {
								/* Reduce radius by orbit radius step amount */
								curNode.setRadius(curNode.getRadius()-orbitRadiusStep);
							/* Radius is close to desired radius */
							} else {
								/* Set radius to desired radius to prevent any more animating */
								curNode.setRadius(orbitRadius);
							}
							
							/* Current node has finished orbit animating */
							if (curNode.orbitFinished)
								continue;
							
							/* Calculate current distance of node from its orbit position */
							dist = Math.round(Math.sqrt(Math.pow(curNode.getCurX()-curNode.orbitPos.getX(),2) + Math.pow(curNode.getCurY()-curNode.orbitPos.getY(),2)));
							/* Node has reached it's orbit position */
							if (dist <= 0) {
								/* Disable node orbit animation */
								curNode.orbitFinished = true;
								/* Increase number nodes which have completed orbit animation */
								orbitAnimFinished++;
							/* Node distance from its orbit position is less than the animation step */
							} else if (dist <= orbitAnimationStep) {
								/* Set node position to its orbit position */
								curNode.setCur(curNode.orbitPos.getX(), curNode.orbitPos.getY());
							/* Node position is greater than the animation step */ 
							} else {
								/* Calculate node position at next animation step */
								x = Math.round(curNode.getCurX()+((curNode.orbitPos.getX()-curNode.getCurX())*(orbitAnimationStep/dist)));
								y = Math.round(curNode.getCurY()+((curNode.orbitPos.getY()-curNode.getCurY())*(orbitAnimationStep/dist)));
								/* Set node position */
								curNode.setCur(x, y);
							}
						/* Node is selected */
						} else {
							curNode.setPrev(curNode.getCurX(), curNode.getCurY());
						}
					}				
				}
			/* All nodes have finished their orbit animations */	
			} else {
				/* Turn off orbit animation */
				orbitAnim = false;
			}
		}
	}
	
	/* Global draw function - run on each timeout() iteration */
	function draw() {
		/* Set canvas variable with the canvas DOM element */
		var canvas = c.find('canvas').get(0);
		
		/* Check for canvas availability */
		if (canvas.getContext == null) {
			return; 
		}
		
		/* Store cavnas drawing context */
		ctx = canvas.getContext('2d');
	
		/* Clear the canvas */
		ctx.clearRect(0, 0, canvasWidth, canvasHeight); 

		/* Run draw method on node collection */
		nodeColl.draw();
		
		if (factored) {
			/* Load factored stuff */
			/*ctx.fillStyle = '#e7e7df';
			ctx.beginPath();
			ctx.arc(canvasWidth/2, canvasHeight/2, 180, 0, Math.PI*2, true);
			ctx.fill();*/
		}
	}
	
	/* Timeout function - run every 30 milliseconds */
	function timeout() {
		/* Run draw and update functions */
		draw();
		update();
		
		/* Run unless simulation is stopped */
		if (!stopped) {
			/* Set timer to run every 30 milliseconds */
			setTimeout(function() { timeout(); }, 30);
		}
	}
	
	/* Enable orbit function */
	function enableOrbit() {
		/* Turn on orbit functionality */
		orbit = true;
	}	
	/* Disable orbit function*/
	function disableOrbit() {
		var nodes, nodeLength, curNode;
		/* Turn off orbit functionality */
		orbit = false;
		/* Reset orbit animation counter */
		orbitAnimFinished = 0;

		nodes = nodeColl.nodes;
		nodeLength = nodes.length;
		
		/* Dist = distance of node orbit exit point away from node divided by the circle radius */
		/* A smaller distance would make the nodes move away at a slower speed */
		var dist = 50/300;
		/* Create empty vector for node exit point */
		var exitPoint = new Vector(0.0, 0.0);
		/* Set origin for distance calculations, currently the centre of the canvas */
		var checkX = canvasWidth/2;
		var checkY = canvasHeight/2;
		
		/* Loop through nodes and run distance calculations */
		for (var i = 0; i < nodeLength; i++) {
			/* Set reference to current node */
			curNode = nodes[i];
			
			if (curNode == null)
				continue; // Move to next iteration
			
			/* Node isn't selected */
			if (!curNode.selected) {
				/* Set node orbit exit point */
				exitPoint.setX(curNode.getCurX()+((checkX-curNode.getCurX())*dist));
				exitPoint.setY(curNode.getCurY()+((checkY-curNode.getCurY())*dist));
				/* Change node previous position to exit point to change node velocity */
				curNode.setPrev(exitPoint.getX(), exitPoint.getY());
			}
			
			/* Node is in orbit animation */
			curNode.orbitFinished = false;
		}
	}
	
	/* Initialisation function - run once */
	function init() {
		var downPos = new Vector(0, 0);
		var mousePos = new Vector(0, 0);
		
		/* Check if mouse position is outside the window bounds */
		function outsideBounds(e) {
			padding = 10;
			windowWidth = $(window).width();
			windowHeight = $(window).height();
			mouseX = e.pageX;
			mouseY = e.pageY;
			
			if (mouseX < (padding*2) || mouseX > windowWidth-(padding*2) || mouseY < (padding*2) || mouseY > windowHeight-(padding*2))
				return true
		}

		/* Set up mouse triggers */
		$(document).mousedown(function(e) {
			/* Not in FactoRED mode */
			if (!factored) {
				/* Check if there is a currently selected node */
				if (nodeColl.selectedNode) {
					/* Turn off orbit functionality */
					disableOrbit();
					
					/* Set selected node force to push it away when closed and orbit mode is quit */ 
					nodeColl.selectedNode.setForce(Math.round(Math.random()*1000)-500, Math.round(Math.random()*1000)-500);
					/* Close selected node */
					nodeColl.selectedNodeClose();
					/* Unselect current node */
					nodeColl.unselectNode();
					/* Reset mouse and offset data */
					savedMousePos = null;
					selectOffset = null;
				}
				
				/* Store mouse position and node offset */
				downPos.setX(e.pageX);
				downPos.setY(e.pageY);
				selectOffset = nodeColl.selectNode(downPos.getX(), downPos.getY());
				
				/* A node has been selected */
				if (selectOffset) {
					/* Turn on orbit functionality */
					enableOrbit();
					/* Open the selected node */
					nodeColl.selectedNodeOpen();
				}
			/* In FactoRED mode */
			} else {
				/* Turn off FactoRED mode */
				factored = false;		
				$('#factored').fadeToggle();	

				/* Turn off orbit functionality */
				disableOrbit();
			}
		});
		
		/* Set up keyboard triggers */
		$(document).keydown(function(e) {
			switch(e.keyCode) {
				case 37: // '<'
					/* Open previous node in orbit mode */
					nodeColl.nextNodeOpen(true);
					break;
				case 39: // '>'
					/* Open next node in orbit mode */
					nodeColl.nextNodeOpen();
					break;
				case 67: // 'c'
					/* Randomise node colours */
					for (var i = 0; i < nodeColl.nodes.length; i++) {
						if (nodeColl.nodes[i] == null)
							continue; // Move to next iteration
						nodeColl.nodes[i].setColour({r: Math.round(Math.random()*255), g: Math.round(Math.random()*255), b: Math.round(Math.random()*255)});
					}
					break;
				case 68: // 'd'
					if (!dataVisTog) {
						/* Add data visualisation to nodes */
						nodeColl.addDataVis();
						dataVisTog = true;
					} else {
						/* Remove data visualisation from nodes */
						nodeColl.removeDataVis();
						dataVisTog = false;
					}
					break;
				case 69: // 'e'
					/* Toggle debug output */
					debug = (!debug) ? true : false;
					break;
				case 70: // 'f'
					/* Randomise node friction */
					for (var i = 0; i < nodeColl.nodes.length; i++) {
						if (nodeColl.nodes[i] == null)
							continue; // Move to next iteration
						nodeColl.nodes[i].setFriction(Math.random()*0.1);
					}					
					break;
				case 72: // 'h'
					/* Toggle simulation information panel */					
					$('#info').fadeToggle('slow');
					break;
				case 79: // 'o'
					/* Toggle orbit mode */
					if (orbit) {
						/* Turn off orbit functionality */
						disableOrbit();
						
						factored = false;		
						$('#factored').fadeToggle();
					} else {
						/* Turn on orbit functionality */
						enableOrbit();
						
						factored = true;
						$('#factored').fadeToggle('fast');
					}
					break;
				case 83: // 's'
					/* Toggle simulation playback */
					stopped = (!stopped) ? true : false;
					if (!stopped) {
						/* Restart timeout function */
						timeout();
					}
					break;
				case 84: // 't'
					/* Toggle simulation speed */
					if (dt == 0.1) {
						dt = 0.2;
					} else {
						dt = 0.1;
					}
					break;
				default:
					break;
			}
		});
		
		/* Set window resize triggers */
		$(window).resize(function(e) {
			/* Update stored canvas size */
			canvasWidth = $(window).width(); // Width of canvas
			canvasHeight = $(window).height(); // Height of canvas
			
			/* Update canvas element dimensions */
			c.find('canvas').eq(0).attr({height: canvasHeight, width: canvasWidth});
			
			/* Update node boundary object */
			bound.setBoundary(0, 0, canvasWidth, canvasHeight);
		});
		
		/* Create a new node boundary object */
		bound = new Boundary(0, 0, canvasWidth, canvasHeight);
		/* Create new node collection object */
		nodeColl = new NodeCollection();
		/* Set negative gravity */
		gravity.setY(-5.0);
		/* Allow simulation to start */ 
		stopped = false;
		
		/* Load considerations and populate node collection */
		$.ajax({
			type: "GET",
			url: "considerations.xml",
			dataType: "xml",
			success: function(xml) {
				var data = xml;
				nodeColl = new NodeCollection();
				var title;
				$(data).find('items item').each(function(){
					title = $(this).find('title').text();
					/* Don't load nodes at edges of canvas */
					nodeColl.newNode(Math.round(Math.random()*canvasWidth), Math.round(Math.random()*canvasHeight), title);
				});
				
				/* Array randomiser */
				function randArray() {
					return (Math.round(Math.random())-0.5);
				}
				
				/* Randomise order of nodes */
				nodeColl.nodes.sort(randArray);
				
				/* Turn on FactoRED mode */
				factored = true;
				$('#factored').hide().fadeToggle('fast');
				enableOrbit();
			}
		});
		
		/* Run timeout function */
		timeout();
	}
	
	/* Create a canvas in chosen element */
	c.canvas();
	
	/* Run initialisation function */
	init();
});