//This is a place to output messages without having to look at the log
var consoleDiv = document.getElementById('consolediv');

//This idenifies the canvas element
var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

//This identifies the inventory canvas
var invCanvas = document.getElementById('inventoryCanvas');
var invctx = invCanvas.getContext('2d');

var images = new Array(); //This is an array used to hold all the images to load
var imageLoaded = new Array(); //This is an array of boolean values used to keep track of whether each image has been loaded

var imgManStill = new Image();
imgManStill.src = 'ManStill.png';
images.push(imgManStill);

var imgGreenBlock = new Image();
imgGreenBlock.src = 'GreenBlock.png';
images.push(imgGreenBlock);

var imgBlackBlock = new Image();
imgBlackBlock.src = 'BlackBlock.png';
images.push(imgBlackBlock);

//This loop sets an onload event for each image to ensure that all images are loaded before the game starts
for (var i = 0; i < images.length; i++){
	imageLoaded[i] = false;
	images[i].onload = function(a){
		return function(){
			imageLoaded[a] = true;
			console.log(images[a].src+" loaded.");
			for (var j = 0; j < imageLoaded.length; j++){
				if (!imageLoaded[j]){
					return;
				}
			}
			console.log("Starting Game...");
			startGame();
		}
	}(i);
}

var startGame = function(){
	
	var gameObjects = new Array();
	var otherPlayers = new Array();
	
	var socket = io.connect('http://www.socketmans.com');
	
	socket.on('player joined', function(data){
		otherPlayers[data.playerIndex] = new Man();
		emitUpdate();
	});
	
	socket.on('existing players', function(existingPlayers){
		for (var i = 0; i < existingPlayers.length; i++){
			otherPlayers[existingPlayers[i]] = new Man();
		}
	});
	
	socket.on('environment load', function(blocks){
		envBlocks.blockLayout = blocks;
		gameCycle();
	});
	
	socket.on('removeBlock', function(data){
		envBlocks.blockLayout[data.row][data.column] = 0;
	});
	
	socket.on('addBlock', function(data){
		envBlocks.blockLayout[data.row][data.column] = data.type;
		userMan.position[1]-=0.1; //When a man is standing on a block, he actually is overlapping the very top of it,
						    //so this prevents the man from re-centering unnecessarily if he's partially standing
						    //on another block when dropping his block
		if (userMan.isInBlock(data.row, data.column)){
			console.log("Player must be moved from "+data.row+", "+data.column+".");
			if (envBlocks.blockLayout[data.row - 1][data.column] == 0){
				userMan.position = [ data.column*50 + (50 - userMan.width) / 2,(data.row - 1) * 50 + (50 - userMan.height) / 2 ];
				console.log("Player was moved to "+(data.row - 1)+", "+data.column+".");
			}else if (envBlocks.blockLayout[data.row][data.column - 1] == 0){
				userMan.position = [ (data.column - 1)*50 + (50 - userMan.width) / 2,data.row * 50 + (50 - userMan.height) / 2 ];
				console.log("Player was moved to "+data.row+", "+(data.column - 1)+".");
			}else if (envBlocks.blockLayout[data.row][data.column + 1] == 0){
				userMan.position = [ (data.column + 1)*50 + (50 - userMan.width) / 2,data.row * 50 + (50 - userMan.height) / 2 ];
				console.log("Player was moved to "+data.row+", "+(data.column + 1)+".");
			}
		}
	});
		
	
	socket.on('player left', function(data){
		delete otherPlayers[data.playerIndex];
	});
	
	function emitUpdate(){
		if (userMan){
			socket.emit('clientManUpdate', {
				position : userMan.position,
				velocity: userMan.velocity
			});
		}
	}
	
	socket.on('serverManUpdate', function(data){
		otherPlayers[data.playerIndex].position = data.position;
		otherPlayers[data.playerIndex].velocity = data.velocity;
	});
	
	socket.on('shareMessage', function(data){
		otherPlayers[data.playerIndex].addSpeechBubble(data.message);
	});
	
	
	var frameTimes = new Array(10);
	for (var i = 0; i < frameTimes.length; i++){
		frameTimes[i] = 0;
	}
	var markFrameStart = function(){
		var a = new Date();
		for (var i = (frameTimes.length - 1); i > 0 ; i--){
			frameTimes[i] = frameTimes[i-1];
		}
		frameTimes[0] = a.getTime();
	}
	
	var getFrameRate = function(){
		var avgTime = (frameTimes[0] - frameTimes[frameTimes.length - 1]) / frameTimes.length;
		return Math.floor(1000 / avgTime);
	}
	
	var getLatestFrameLength = function(){
		return (frameTimes[0] - frameTimes[1]);
	}
		
	//This is the basic cycle that is constantly repeating for the game to work. The timeouts are adjusted to make sure the 
	//frame rate stays at around 30 fps (I don't want to use setInterval, b/c if a cycle takes longer than 35msec it may cause
	//two game cycles to run at once)
	function gameCycle(){
		markFrameStart();
		var startTime = new Date();
		gameUpdate();
		gameDraw();
		var endTime = new Date();
		var t = (endTime.getTime() - startTime.getTime() < 35) ? 35 - (endTime.getTime() - startTime.getTime()) : 0;
		t -= Math.max((getLatestFrameLength() - 35), 0);
		t = Math.max(0, t);
		window.setTimeout(gameCycle, t);
		consoleDiv.innerHTML = "extra cycle time: " + t +"msec";
		consoleDiv.innerHTML += "<br/>FPS: "+getFrameRate();
	}
	
	//This function is for updating the position and state of game objects.
	function gameUpdate(){
		for (var i = 0; i < gameObjects.length; i++)
		{
			gameObjects[i].update();
		}
		for (var i = 0; i < otherPlayers.length; i++)
		{
			if (otherPlayers[i]){
				otherPlayers[i].update();
			}
		}
		if (chatInterface){
			chatInterface.update();
		}
	}
	
	//This function clears the canvas and draws the current frame.
	function gameDraw(){
		ctx.save();		
		ctx.clearRect(0, 0, 800, 600);
		moveFrame();
		if (envBlocks){
			envBlocks.draw();
		}
		for (var i = 0; i < gameObjects.length; i++)
		{
			gameObjects[i].draw();
		}
		for (var i = 0; i < otherPlayers.length; i++)
		{
			if (otherPlayers[i]){
				otherPlayers[i].draw();
			}
		}		
		ctx.restore();
		if (chatInterface){
			chatInterface.draw();
		}
	}
	
	//This and the onkeyup functions are where you implement the controls.
	window.onkeydown = function(event){
		
		
		if (event.keyCode){
			if (chatInterface.active){
				if ( event.keyCode >= 65 && event.keyCode <= 90){
					event.preventDefault();
					chatInterface.cursorCount = 15;
					if (event.shiftKey){
						chatInterface.displayString += String.fromCharCode(event.keyCode);
					}else{
						chatInterface.displayString += String.fromCharCode(event.keyCode + 32);
					}
				}else if (event.keyCode == 8){
					event.preventDefault();
					chatInterface.cursorCount = 15;
					chatInterface.displayString = chatInterface.displayString.slice(0, chatInterface.displayString.length - 1);
				}else if (event.keyCode == 13){
					chatInterface.active = false;
					if (chatInterface.displayString){
						socket.emit('sendMessage', chatInterface.displayString);
						userMan.addSpeechBubble(chatInterface.displayString);
						chatInterface.displayString = "";
					}
				}else{
					var charMap = function(code, lower, upper){
						if (event.keyCode == code){
							if (event.shiftKey && upper){
								chatInterface.displayString += upper;
							}else{
								chatInterface.displayString += lower;
							}
							chatInterface.cursorCount = 15;
							event.preventDefault();
						}
					}
					charMap(32, " ");
					charMap(48, "0", ")");
					charMap(49, "1", "!");
					charMap(50, "2", "@");
					charMap(51, "3", "#");
					charMap(52, "4", "$");
					charMap(53, "5", "%");
					charMap(54, "6", "^");
					charMap(55, "7", "&");
					charMap(56, "8", "*");
					charMap(57, "9", "(");
					charMap(96, "0");
					charMap(97, "1");
					charMap(98, "2");
					charMap(99, "3");
					charMap(100, "4");
					charMap(101, "5");
					charMap(102, "6");
					charMap(103, "7");
					charMap(104, "8");
					charMap(105, "9");
					charMap(106, "*");
					charMap(107, "+");
					charMap(109, "-");
					charMap(110, ".");
					charMap(111, "/");
					charMap(186, ";", ":");
					charMap(187, "=", "+");
					charMap(188, ",", "<");
					charMap(189, "-", "_");
					charMap(190, ".", ">");
					charMap(191, "/", "?");
					charMap(222, "\'", "\"");
				}
			}else{			
				switch(event.keyCode)
				{
					case 13:
						chatInterface.active = true;
						event.preventDefault();
						break;
					case 32:
						userMan.blockManipulate();
						event.preventDefault();
						break;
					case 37:
						userMan.moveLeftStart();
						emitUpdate();
						event.preventDefault();
						break;
					case 38:
						userMan.jump();
						emitUpdate();
						event.preventDefault();
						break;
					case 39:
						userMan.moveRightStart();
						emitUpdate();
						event.preventDefault();
						break;
				}
			}
		}
	}
	
	window.onkeyup = function(event){
		if (event.keyCode){
			switch(event.keyCode)
			{
				case 37:
					userMan.moveLeftStop();
					emitUpdate();
					break;
				case 39:
					userMan.moveRightStop();
					emitUpdate();
					break;
			}
		}
	}
	
	function GameObject(){
		this.position = new Array(2);
		this.width = 1;
		this.height = 1;
		this.velocity = new Array(2);
		this.update = function(){
			
		};
		this.draw = function(){
			
		};
	}
	
	function Man(){
		var man = new GameObject();
		man.velocity = [0, 0];
		man.position = [400, -100];
		man.width = 34;
		man.height = 49;
		man.inventory = 0;
		man.update = function(){
			man.position[0] += man.velocity[0];
			if (man.position[0] >=0){
				//we need to subtract 1 from the vertical position for the bottom corners, otherwise when the man is standing on a platform it's think he's hittng a wall too
				//likewise, we need to add 1 to the vertical position for the top corners, so it doesn't detect horizontal collisions when a man hits his head on the ceiling
				if (man.position[1] + 1>= 0){
					var hTopLeftBlock = envBlocks.blockLayout[Math.floor((man.position[1] + 1) / 50)]
											  [Math.floor(man.position[0] / 50)];
				}else{var hTopLeftBlock = 0;}
				if (man.position[1] - 1 + man.height >=0){
					var hBotLeftBlock = envBlocks.blockLayout[Math.floor((man.position[1] - 1+man.height) / 50)]
											  [Math.floor(man.position[0] / 50)];
				}else{var hBotLeftBlock = 0;}
				if (hTopLeftBlock || hBotLeftBlock){
					man.position[0] = man.position[0] + (50 - man.position[0] % 50);
				}
			}else{
				man.position[0] = 0;
			}
			
			if (man.position[0] + man.width <= 50*envBlocks.blockLayout[0].length){
				if (man.position[1] + 1>= 0){
					var hTopRightBlock = envBlocks.blockLayout[Math.floor((man.position[1] + 1) / 50)]
												[Math.floor((man.position[0]+man.width) / 50)];
				}else{var hTopRightBlock = 0;}
				if (man.position[1] - 1+ man.height >=0){
					var hBotRightBlock = envBlocks.blockLayout[Math.floor((man.position[1] - 1 +man.height) / 50)]
												[Math.floor((man.position[0]+man.width) / 50)];
				}else{var hBotRightBlock = 0;}
				if (hTopRightBlock || hBotRightBlock){
					man.position[0] = man.position[0] - ((man.position[0]+man.width) % 50) - 1;
				}
			}else{
				man.position[0] = 50*envBlocks.blockLayout[0].length - man.width;
			}			
			
			man.position[1] += man.velocity[1];
			man.velocity[1] += 1.5;
			if (man.position[1] + man.height >=0){
				//see if there's a block present at the bottom left corner of the man
				var botLeftBlock = envBlocks.blockLayout[Math.floor((man.position[1]+man.height) / 50)]
											  [Math.floor(man.position[0] / 50)];
				//see if there's a block present at the bottom right corner of the man
				var botRightBlock = envBlocks.blockLayout[Math.floor((man.position[1]+man.height) / 50)]
											  [Math.floor((man.position[0]+man.width) / 50)];
				if (man.velocity[1] >= 0 && (botLeftBlock || botRightBlock)){
					man.position[1] = Math.floor((man.position[1]+man.height) / 50) * 50 - man.height;
					man.velocity[1] = 0;
				}
			}
			if (man.position[1] >= 0){
				//see if there's a block present at the top left corner of the man
				var topLeftBlock = envBlocks.blockLayout[Math.floor((man.position[1]) / 50)]
											  [Math.floor(man.position[0] / 50)];
				//see if there's a block present at the top right corner of the man
				var topRightBlock = envBlocks.blockLayout[Math.floor((man.position[1]) / 50)]
											  [Math.floor((man.position[0]+man.width) / 50)];
				
				if ((man.velocity[1] < 0) && topLeftBlock || topRightBlock){
					man.position[1] = (Math.floor((man.position[1]) / 50)+1) * 50;
					man.velocity[1] = 0;			
				}
			}
			if (man.hasSpeechBubble){
				man.speechBubbleCounter--;
				if (man.speechBubbleCounter <= 0){
					man.hasSpeechBubble = false;
				}
			}
		}
		man.draw = function(){
			ctx.drawImage(imgManStill, man.position[0], man.position[1], man.width, man.height);
			if (man.hasSpeechBubble){
				man.drawSpeechBubble();
			}
		}
		man.isInBlock = function(row, column){
			if ((column + 1)*50 >= man.position[0] && man.position[0] + man.width >= column * 50){
				if ((row + 1) * 50 > man.position[1] && man.position[1] + man.height >= row * 50){
					return true;
				}
			}
			return false;
		}
		man.jump = function(){
			man.velocity[1] = -18;
		}
		man.moveRightStart = function(){
			man.velocity[0] += 9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		man.moveRightStop = function(){
			man.velocity[0] -= 9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		man.moveLeftStart = function(){
			man.velocity[0] += -9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		man.moveLeftStop = function(){
			man.velocity[0] += 9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		man.addSpeechBubble = function(statement){
			man.hasSpeechBubble = true;
			man.speechBubbleCounter = 150;
			ctx.font = "bold 20px sans-serif";
			if (ctx.measureText(statement).width <= 230){
				man.sBWidth = ctx.measureText(statement).width + 20;
				man.sBHeight = 50;
				man.statement = new Array(0);
				man.statement[0] = statement;
			}else{
				man.sBWidth = 250;
				man.statement = new Array(0);
				var splitStatement = statement.split(" ");
				var currentRow = 0;
				var currentWidth = 0;
				var spaceWidth = ctx.measureText(" ").width;
				console.log("Space Width: " + spaceWidth);
				for (var i = 0; i < splitStatement.length; i++){
					if (currentWidth == 0){
						man.statement[currentRow] = "";
						if (ctx.measureText(splitStatement[i]).width < 230){
							man.statement[currentRow] += splitStatement[i];
							currentWidth += ctx.measureText(splitStatement[i]).width;
						}else{
							for (var j = 1; j <= splitStatement[i].length; j++){
								if (ctx.measureText(splitStatement[i].slice(0, -j)+"-").width < 230){
									man.statement[currentRow] += splitStatement[i].slice(0, -j)+"-";
									splitStatement[i] = splitStatement[i].slice(-j, splitStatement[i].length);
									currentRow++;
									currentWidth = 0;
									i--; //This is the same as redoing this iteration on a new row
									break;
								}
							}
						}
					}else{
						if (currentWidth + spaceWidth + ctx.measureText(splitStatement[i]).width < 230){
							man.statement[currentRow] += " "+splitStatement[i];
							currentWidth += ctx.measureText(" "+splitStatement[i]).width;
						}else{
							currentRow++;
							currentWidth = 0;
							i --; //This is the same as redoing this iteration on a new row
						}
					}
				}
				man.sBHeight = 20 + 25*man.statement.length;				
			}
		}
		man.drawSpeechBubble = function(){
			drawSpeechBubble(man.position[0], man.position[1], man.sBWidth, man.sBHeight);
			ctx.fillStyle="#000000";
			ctx.font = "bold 20px sans-serif";
			for (var i = 0; i < man.statement.length; i++){
				ctx.fillText(man.statement[i], man.position[0] + 42, man.position[1] - man.sBHeight + 7 + 25*i);
			}
		}
		man.blockManipulate = function(){
			var blockRow = Math.floor((man.position[1]+man.height) / 50);
			var blockColumn = Math.floor((man.position[0] + man.width / 2) / 50);
			if (blockRow >= 0 && blockColumn >= 0){
				if (man.inventory == 0){
					//These two if statements allow the player to grab a block from the left or the right if he is pushing against a wall
					if (man.velocity[0] > 0){
						if (envBlocks.blockLayout[blockRow - 1][Math.floor((man.position[0] + man.width + 1)/50)] != 0){
							blockRow--;
							blockColumn = Math.floor((man.position[0] + man.width + 1)/50);
						}
					}else if (man.velocity[0] < 0){
						if (envBlocks.blockLayout[blockRow - 1][Math.floor((man.position[0] - 1)/50)] != 0){
							blockRow--;
							blockColumn = Math.floor((man.position[0] - 1)/50);
						}
					}
					switch(envBlocks.blockLayout[blockRow][blockColumn]){
						case 0:
							break;
						case 1:
							socket.emit('blockTakeRequest', {
								row: blockRow,
								column: blockColumn
							});
							break;
						case 2:
							break;
					}
				}else{
					switch(man.inventory){
						case 1:
							if (envBlocks.blockLayout[blockRow][blockColumn] == 0){
								socket.emit('blockDropRequest', {
									row: blockRow,
									column: blockColumn,
									type: 1
								});
							}else if (blockRow > 0 && envBlocks.blockLayout[blockRow - 1][blockColumn] == 0){
								socket.emit('blockDropRequest', {
									row: (blockRow - 1),
									column: blockColumn,
									type: 1
								});
							}
					}
				}
			}
		}
		socket.on('Pickup', function(pickup){
			man.inventory = pickup;
			switch(pickup){
				case 1:
					invctx.drawImage(imgGreenBlock, 12.5, 12.5);
					break;
			}
		});
		socket.on('Drop', function(){
			man.inventory = 0;
			invctx.clearRect(0,0,75,75);			
		});
		
		return man;
	}
	
	var userMan = new Man();
	gameObjects.push(userMan);
	
	//This defines the blocks used to make up the environment
	var envBlocks = {
		blockLayout : [	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]],
		draw : function(){
			for (var i = 0; i < envBlocks.blockLayout.length; i++){
				for (var j = 0; j < envBlocks.blockLayout[i].length; j++){
					if (envBlocks.blockLayout[i][j]){
						switch(envBlocks.blockLayout[i][j]){
						case 1:
							ctx.drawImage(imgGreenBlock, 50*j, 50*i);
							break;
						case 2:
							ctx.drawImage(imgBlackBlock, 50*j, 50*i);
							break;
						}
					}
				}
			}
		}
	}
	
	var chatInterface = {
		active : false,
		displayString : "",
		cursorCount: 0,
		draw : function(){
			if (chatInterface.active){
				ctx.font = "bold 20px sans-serif";
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(15, 552, 770, 30);
				ctx.strokeRect(15, 552, 770, 30);
				ctx.fillStyle = "#000000";				
				ctx.fillText("Chat:", 20, 575);
				if (Math.floor(chatInterface.cursorCount / 15) == 0){
					ctx.fillText(chatInterface.displayString, 75, 575);
				}else{
					ctx.fillText(chatInterface.displayString + "|", 75, 575);
				}
			}
		},
		update : function(){
			if (chatInterface.active){
				chatInterface.cursorCount++;
				if (chatInterface.cursorCount >=30){
					chatInterface.cursorCount = 0;
				}
			}
		}
	}
	
	var drawSpeechBubble = function(x, y, width, height){
		width = Math.max(width, 50);
		height = Math.max(height, 50);
		ctx.beginPath();  
		ctx.moveTo(x+35,y-height-20);  
		ctx.lineTo(x+35,y-20);  
		ctx.lineTo(x+60,y-20);  
		ctx.quadraticCurveTo(x+60,y,x+40,y+5);  
		ctx.quadraticCurveTo(x+70,y,x+75,y-20);  
		ctx.lineTo(x+35+width,y-20);  
		ctx.lineTo(x+35+width,y-height-20);
		ctx.lineTo(x+35,y-height-20);
		ctx.fillStyle = "#ffffff";
		ctx.fill();
		ctx.strokeStyle = "#000000";
		ctx.stroke();
	}
	
	var moveFrame = function(){
		var xTranslate = Math.max(Math.min(-userMan.position[0] + 400, 0), 800 - envBlocks.blockLayout[0].length*50);
		var yTranslate = Math.max(Math.min(-userMan.position[1] + 300, 0), 600 - envBlocks.blockLayout.length*50);
		ctx.translate(xTranslate, yTranslate);
	}
}
