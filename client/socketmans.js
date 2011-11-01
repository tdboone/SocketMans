//This is a place to output messages without having to look at the log
var consoleDiv = document.getElementById('consolediv');

//This idenifies the canvas element
var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

//This identifies the inventory canvas, which displays whether your character is holding something
var invCanvas = document.getElementById('inventoryCanvas');
var invctx = invCanvas.getContext('2d');

var images = new Array(); //This is an array used to hold all the images to load
var imageLoaded = new Array(); //This is an array of boolean values used to keep track of whether each image has been loaded
var addImage = function(srcName){ //This function is used to create an image, and add onload functions to have
						   //the game start when all images are laoded.
	var a = new Image();
	images.push(a); 
	var index = images.length - 1;
	imageLoaded[index] = false;
	a.onload = function(i){
		return function(){
			imageLoaded[i] = true;
			console.log(images[i].src+" loaded.");
			for (var j = 0; j < imageLoaded.length; j++){
				if (!imageLoaded[j]){
					return;
				}
			}
			console.log("Starting Game...");
			startGame();
		}
	}(index);
	a.src = srcName;
	return a;
}

//These are the images to load for the game
var imgManRunBl = addImage('ManRunBl.png');
var imgManRunR = addImage('ManRunR.png');
var imgManRunG = addImage('ManRunG.png');
var imgManRunB = addImage('ManRunB.png');
var imgManStandBl = addImage('ManStandBl.png');
var imgManStandR = addImage('ManStandR.png');
var imgManStandG = addImage('ManStandG.png');
var imgManStandB = addImage('ManStandB.png');
var imgManJumpBl = addImage('ManJumpBl.png');
var imgManJumpR = addImage('ManJumpR.png');
var imgManJumpG = addImage('ManJumpG.png');
var imgManJumpB = addImage('ManJumpB.png');
var imgGreenBlock = addImage('GreenBlock.png');
var imgBlackBlock = addImage('BlackBlock.png');
var imgRedBlock = addImage('RedBlock.png');
var imgBlueBlock = addImage('BlueBlock.png');
var imgBrownBlock = addImage('BrownBlock.png');
var imgOrangeBlock = addImage('OrangeBlock.png');
var imgPinkBlock = addImage('PinkBlock.png');
var imgPurpleBlock = addImage('PurpleBlock.png');
var imgTealBlock = addImage('TealBlock.png');
var imgWhiteBlock = addImage('WhiteBlock.png');
var imgYellowBlock = addImage('YellowBlock.png');

var startGame = function(){
	
	//Right now the game objects array is just used to hold the user's character, but if other different objects
	//are added they could go in here too.
	var gameObjects = new Array();
	//This array is used to store all of the other players. NOTE: The indices for each player in this array correspond
	//to their indices in the array on the server. This means that there will be a blank spot in this array corresponding
	//to the index of the current player.
	var otherPlayers = new Array();
	
	var socket = io.connect('http://www.socketmans.com');
	
	//This adds a player to the clients playspace when a new user joins.
	socket.on('player joined', function(data){
		otherPlayers[data.playerIndex] = new Man();
		emitUpdate();
	});
	
	//This adds all existing players when the current user first joins.
	socket.on('existing players', function(existingPlayers){
		for (var i = 0; i < existingPlayers.length; i++){
			otherPlayers[existingPlayers[i]] = new Man();
		}
	});
	
	//This receives the environment block layout from the server and starts the game cycle once that happens.
	socket.on('environment load', function(blocks){
		envBlocks.blockLayout = blocks;
		gameCycle();
	});
	
	//This removes a block when any player has a successful remove block request go through the server
	socket.on('removeBlock', function(data){
		envBlocks.blockLayout[data.row][data.column] = 0;
	});
	
	//This adds a block when a user successfully completes an add block request through the server. This also displaces the user's character if necessary.
	socket.on('addBlock', function(data){
		envBlocks.blockLayout[data.row][data.column] = data.type;
		userMan.position[1]-=0.1; //When a man is standing on a block, he actually is overlapping the very top of it,
						    //so this prevents the man from re-centering unnecessarily if he's partially standing
						    //on another block when dropping his block
		if (userMan.isInBlock(data.row, data.column)){
			//If the space above the block being dropped is open, just move the player there.
			if (envBlocks.blockLayout[data.row - 1][data.column] == 0){
				userMan.position = [ data.column*50 + (50 - userMan.width) / 2,(data.row - 1) * 50 + (50 - userMan.height) / 2 ];
			//Otherwise, if the space to the left of the block being dropped is open, move the player there.
			}else if (envBlocks.blockLayout[data.row][data.column - 1] == 0){
				userMan.position = [ (data.column - 1)*50 + (50 - userMan.width) / 2,data.row * 50 + (50 - userMan.height) / 2 ];
			//Otherwise, if the space to the right of the block being dropped is open, move the player there.
			}else if (envBlocks.blockLayout[data.row][data.column + 1] == 0){
				userMan.position = [ (data.column + 1)*50 + (50 - userMan.width) / 2,data.row * 50 + (50 - userMan.height) / 2 ];
			}
			//Since the client only displaces it's own character, emit an update to let other clients know where you ended up.
			emitUpdate();
		}
	});
		
	//When another client quits, this removes their character
	socket.on('player left', function(data){
		delete otherPlayers[data.playerIndex];
	});
	
	//This sends an update to the current player's position and velocity to share with everyone else
	function emitUpdate(){
		if (userMan){
			socket.emit('clientManUpdate', {
				position : userMan.position,
				velocity: userMan.velocity
			});
		}
	}
	
	//This implements another client's position and velocity update
	socket.on('serverManUpdate', function(data){
		otherPlayers[data.playerIndex].position = data.position;
		otherPlayers[data.playerIndex].velocity = data.velocity;
	});
	
	//This adds a speech bubble display to another character who has sent a message
	socket.on('shareMessage', function(data){
		otherPlayers[data.playerIndex].addSpeechBubble(data.message);
	});
	
	//This array is used to keep track of the start time of the last ten frames to keep track of the average frame rate
	var frameTimes = new Array(10);
	for (var i = 0; i < frameTimes.length; i++){
		frameTimes[i] = 0;
	}
	//This function is called at the start of each frame to mark the system time in the above array
	var markFrameStart = function(){
		var a = new Date();
		for (var i = (frameTimes.length - 1); i > 0 ; i--){
			frameTimes[i] = frameTimes[i-1];
		}
		frameTimes[0] = a.getTime();
	}
	
	//This function uses the frameTimes array to calculate the frame rate over the last 10 frames
	var getFrameRate = function(){
		var avgTime = (frameTimes[0] - frameTimes[frameTimes.length - 1]) / frameTimes.length;
		return Math.floor(1000 / avgTime);
	}
	
	//This function returns the length of the most recent frame in milliseconds
	var getLatestFrameLength = function(){
		return (frameTimes[0] - frameTimes[1]);
	}
		
	//This is the basic cycle that is constantly repeating for the game to work. The timeouts are adjusted to make sure the 
	//frame rate stays at around 30 fps (I don't want to use setInterval, b/c if a cycle takes longer than 35msec it may cause
	//two game cycles to run at once)
	function gameCycle(){
		markFrameStart();
		var startTime = new Date();
		//call the update and draw functions, which form the meat of the game function
		gameUpdate();
		gameDraw();		
		var endTime = new Date();
		//The difference between the startTime and endTime is the amount of time it takes gameUpdate and gameDraw to execute.
		//This time is then subtracted from the desired frame length (35msec) to determine the setTimeout time
		var t = (endTime.getTime() - startTime.getTime() < 35) ? 35 - (endTime.getTime() - startTime.getTime()) : 0;
		//If the previous frame ran longer than 35 msec, then subtract the difference from the setTimeout time. While this means an exceptionally
		//long frame is followed by a shorter-than-normal one, this compensting keeps the overall frame rate more consistent.
		t -= Math.max((getLatestFrameLength() - 35), 0);
		t = Math.max(0, t);
		//Once an appropriate idle time has been calculated, setTimeout is called to perform the game cycle once more.
		window.setTimeout(gameCycle, t);
		//ConsoleDiv is used right now to keep track of the idle time and average frame rate, as a monitor of how close the Draw and Update cycles
		//are to having too much going on.
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
		ctx.save();	 //Because transformations are used to follow the player around, the context is saved and restored through each cycle so
				 //that all transformations can be performed from the zero position
		ctx.clearRect(0, 0, 800, 600);
		moveFrame(); //This function translates the visible window to follow the player
		//Draw all game objects (right now just the user's character)
		for (var i = 0; i < gameObjects.length; i++)
		{
			gameObjects[i].draw();
		}
		//Draw everyone else's characters
		for (var i = 0; i < otherPlayers.length; i++)
		{
			if (otherPlayers[i]){
				otherPlayers[i].draw();
			}
		}
		ctx.globalCompositeOperation = 'destination-over';
		//Draw the blocks that make up the environment
		if (envBlocks){
			envBlocks.draw();
		}
		ctx.restore();
		//If the chat interface is in use then draw it
		if (chatInterface){
			chatInterface.draw();
		}
	}
	
	//This and the onkeyup functions are where you implement the controls.
	window.onkeydown = function(event){		
		
		if (event.keyCode){
			//This if statment contains all the keystrokes picked up by the chat interface
			if (chatInterface.active){
				//This is where all the letters are assigned their keystrokes
				if ( event.keyCode >= 65 && event.keyCode <= 90){
					event.preventDefault();
					chatInterface.cursorCount = 15;
					if (event.shiftKey){
						chatInterface.displayString += String.fromCharCode(event.keyCode);
					}else{
						chatInterface.displayString += String.fromCharCode(event.keyCode + 32);
					}
				//This handles the backspace key
				}else if (event.keyCode == 8){
					event.preventDefault();
					chatInterface.cursorCount = 15;
					chatInterface.displayString = chatInterface.displayString.slice(0, chatInterface.displayString.length - 1);
				//This handles the enter key, which sends the message if there's one there, and removes the chat interface display
				}else if (event.keyCode == 13){
					chatInterface.active = false;
					if (chatInterface.displayString){
						socket.emit('sendMessage', chatInterface.displayString);
						userMan.addSpeechBubble(chatInterface.displayString);
						chatInterface.displayString = "";
					}
				//This handles numbers and special characters by using the charMap function to assign them to their keycodes
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
					//Top row number keys:
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
					//Number pad keys:
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
					//Punctuation keys:
					charMap(186, ";", ":");
					charMap(187, "=", "+");
					charMap(188, ",", "<");
					charMap(189, "-", "_");
					charMap(190, ".", ">");
					charMap(191, "/", "?");
					charMap(222, "\'", "\"");
				}
			}else{	
				//If the chat interface is not active, this picks up the other keystrokes
				switch(event.keyCode)
				{
					//Press enter to bring up the chat interface
					case 13:
						chatInterface.active = true;
						event.preventDefault();
						break;
					//Space bar is used for block manipulation
					case 32:
						userMan.blockManipulate();
						event.preventDefault();
						break;
					//Left, right and up arrows are used for running and jumping
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
				//The character stops moving to the left or to the right when the left or right arrow is released.
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
	
	//GameObject is meant to be a class for all game objects to inherit from, but right now that just includes player characters
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
	
	//"Man" is the prototype for all ;player characters
	function Man(){
		var man = new GameObject();
		man.velocity = [0, 0];
		//Players start above the visible playing field to keep them from getting stuck in a block upon loading or something
		man.position = [400, -100];
		man.width = 34;
		man.height = 49;
		man.inventory = 0;
		man.color = [3, 1, 3];
		man.inAir = false; //Whether the man is currently in the air
		man.lastFacing = 1; //The direction the man was last moving in (right = 1, left = -1)
		man.update = function(){
			//The first thing to update is to move the man horizontally according to his horizontal velocity
			man.position[0] += man.velocity[0];
			//Set the "last facing" property appropriately
			if (man.velocity[0] > 0){
				man.lastFacing = 1;
			}else if (man.velocity[0] < 0){
				man.lastFacing = -1;
			}
			//This if statement determines if a man is colliding with a block or with the edge of the play space on his left side. If so he is moved flush
			//with the boundary he is colliding with
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
			
			//This if statement determines if a man is colliding with a block or with the edge of the play space on his right side. If so he is moved flush
			//with the boundary he is colliding with
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
			
			//Next update the man's vertical position using his vertical velocity
			man.position[1] += man.velocity[1];
			//To simulate gravity, add a small amount to the vertical velocity with each frame
			man.velocity[1] += 1.5;
			if (man.position[1] + man.height >=0){
				//see if there's a block present at the bottom left corner of the man
				var botLeftBlock = envBlocks.blockLayout[Math.floor((man.position[1]+man.height) / 50)]
											  [Math.floor(man.position[0] / 50)];
				//see if there's a block present at the bottom right corner of the man
				var botRightBlock = envBlocks.blockLayout[Math.floor((man.position[1]+man.height) / 50)]
											  [Math.floor((man.position[0]+man.width) / 50)];
				//if a block is present in either bottom corner, shift the man up on top of the block he's colliding with
				if (man.velocity[1] >= 0 && (botLeftBlock || botRightBlock)){
					man.position[1] = Math.floor((man.position[1]+man.height) / 50) * 50 - man.height;
					man.velocity[1] = 0;
					man.inAir = false;
				}else{
					man.inAir = true;
				}
			}
			if (man.position[1] >= 0){
				//see if there's a block present at the top left corner of the man
				var topLeftBlock = envBlocks.blockLayout[Math.floor((man.position[1]) / 50)]
											  [Math.floor(man.position[0] / 50)];
				//see if there's a block present at the top right corner of the man
				var topRightBlock = envBlocks.blockLayout[Math.floor((man.position[1]) / 50)]
											  [Math.floor((man.position[0]+man.width) / 50)];
				//if a block is present in either top corner, shift the man to directly blow the block he's colliding with
				if ((man.velocity[1] < 0) && topLeftBlock || topRightBlock){
					man.position[1] = (Math.floor((man.position[1]) / 50)+1) * 50;
					man.velocity[1] = 0;			
				}
			}
			//count down the speech bubble timer
			if (man.hasSpeechBubble){
				man.speechBubbleCounter--;
				if (man.speechBubbleCounter <= 0){
					man.hasSpeechBubble = false;
				}
			}
		}
		//This is the animation to display when the man is running
		man.runAnimation = new RGBAnimation(imgManRunBl, imgManRunR, imgManRunG, imgManRunB, 16, 1, man.color);
		//This is the animation to display when the man is standing still
		man.standAnimation = new RGBAnimation(imgManStandBl, imgManStandR, imgManStandG, imgManStandB, 8, 2, man.color);
		man.draw = function(){			
			//if the man is in the air, draw the "jumping" image (flipped horizontally if the man was last facing to the left)
			if (man.inAir){
				//drawing different colored characters is acheived by drawing a black base image and then filling in body sections by repeatedly drawing 
				//dark red, green and blue images with the "lighter" global compositing option turned on.
				if (man.lastFacing > 0){
					ctx.drawImage(imgManJumpBl, man.position[0], man.position[1]);					
					ctx.globalCompositeOperation = 'lighter';
					for (var i = 0; i < man.color[0]; i++){
						ctx.drawImage(imgManJumpR, man.position[0], man.position[1]);				
					}
					for (var i = 0; i < man.color[1]; i++){
						ctx.drawImage(imgManJumpG, man.position[0], man.position[1]);				
					}
					for (var i = 0; i < man.color[2]; i++){
						ctx.drawImage(imgManJumpB, man.position[0], man.position[1]);				
					}
					ctx.globalCompositeOperation = 'source-over';
				}else{
					ctx.save();
					ctx.scale(-1, 1);
					ctx.drawImage(imgManJumpBl, -man.position[0]-man.width, man.position[1]);
					ctx.globalCompositeOperation = 'lighter';
					for (var i = 0; i < man.color[0]; i++){
						ctx.drawImage(imgManJumpR, -man.position[0]-man.width, man.position[1]);					
					}
					for (var i = 0; i < man.color[1]; i++){
						ctx.drawImage(imgManJumpG, -man.position[0]-man.width, man.position[1]);					
					}
					for (var i = 0; i < man.color[2]; i++){
						ctx.drawImage(imgManJumpB, -man.position[0]-man.width, man.position[1]);					
					}
					ctx.globalCompositeOperation = 'source-over';
					ctx.restore();
				}
			//otherwise if the man is moving to the right, draw the running animation
			}else if (man.velocity[0] > 0){
				man.runAnimation.position[0] = man.position[0];
				man.runAnimation.position[1] = man.position[1];
				man.runAnimation.draw();
				man.runAnimation.update();
			//otherwise if the man is moving to the left, draw the running animation, flipped in the x-direction
			}else if(man.velocity[0] < 0){
				man.runAnimation.position[0] = -man.position[0] - man.width;
				man.runAnimation.position[1] = man.position[1];		
				ctx.save();
				ctx.scale(-1, 1);
				man.runAnimation.draw();
				man.runAnimation.update();
				ctx.restore();
			//otherwise just draw the standing animation
			}else{
				man.standAnimation.position[0] = man.position[0];
				man.standAnimation.position[1] = man.position[1];
				man.standAnimation.draw();
				man.standAnimation.update();
			}
			//If the man has a speech bubble currently then draw it
			if (man.hasSpeechBubble){
				man.drawSpeechBubble();
			}
		}
		//This is a function used when a block is dropped to determine whether the man should be displaced by the block
		man.isInBlock = function(row, column){
			if ((column + 1)*50 >= man.position[0] && man.position[0] + man.width >= column * 50){
				if ((row + 1) * 50 > man.position[1] && man.position[1] + man.height >= row * 50){
					return true;
				}
			}
			return false;
		}
		//This is the function called when the man gets the command to jump
		man.jump = function(){
			man.velocity[1] = -18;
		}
		//This is the function called when the man gets the command to move to the right
		man.moveRightStart = function(){
			man.velocity[0] += 9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		//This is the function called when the man gets the command to stop moving to the right (when the right arrow is released)
		man.moveRightStop = function(){
			man.velocity[0] -= 9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		//This is the function called when the man gets the command to move to the left
		man.moveLeftStart = function(){
			man.velocity[0] += -9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		//This is the function called when the man gets the command to stop moving to the left (when the left arrow is released)
		man.moveLeftStop = function(){
			man.velocity[0] += 9;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 9), -9);
		}
		//When a user sends a message, this function adds a speech bubble to draw above their character for a limited time
		man.addSpeechBubble = function(statement){
			man.hasSpeechBubble = true;
			//This is the number of frames that the speech bubble remains on the screen
			man.speechBubbleCounter = 150;
			ctx.font = "bold 20px sans-serif";
			//If the statement is able to fit in a speech bubble on one line, then the statement array has a single element containing that statement
			if (ctx.measureText(statement).width <= 230){
				man.sBWidth = ctx.measureText(statement).width + 20;
				man.sBHeight = 50;
				man.statement = new Array(0);
				man.statement[0] = statement;
			//Otherwise, the statement needs to be split into multiple elements, representing multiple lines that will fit in the maximum speech
			//bubble width.
			}else{			
				man.sBWidth = 250;
				man.statement = new Array(0);
				//Split the statement apart word by word
				var splitStatement = statement.split(" ");
				var currentRow = 0;
				var currentWidth = 0;
				var spaceWidth = ctx.measureText(" ").width;
				for (var i = 0; i < splitStatement.length; i++){
					//for the first word of a new line (currentWidth == 0), simply add the word to the line if it fits
					//otherwise, hyphenate the word
					if (currentWidth == 0){
						man.statement[currentRow] = "";
						if (ctx.measureText(splitStatement[i]).width < 230){
							man.statement[currentRow] += splitStatement[i];
							currentWidth += ctx.measureText(splitStatement[i]).width;
						//This is the code that hyphenates the word
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
					//for words that are not the first word, if it doesn't fit in the remaining space for that line, then start a new line.
					//Otherwise the word is added to the current line.
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
		//This function daws a speech bubble containing the most recent statement over the man's location
		man.drawSpeechBubble = function(){
			drawSpeechBubble(man.position[0], man.position[1], man.sBWidth, man.sBHeight);
			ctx.fillStyle="#000000";
			ctx.font = "bold 20px sans-serif";
			for (var i = 0; i < man.statement.length; i++){
				ctx.fillText(man.statement[i], man.position[0] + 42, man.position[1] - man.sBHeight + 7 + 25*i);
			}
		}
		//This function is used to either pick up or drop a block, depending on the man's inventory
		man.blockManipulate = function(){
			var blockRow = Math.floor((man.position[1]+man.height) / 50);
			var blockColumn = Math.floor((man.position[0] + man.width / 2) / 50);
			if (blockRow >= 0 && blockColumn >= 0){
				//If the man's inventory is empty, then attempt to take a block
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
					if(envBlocks.blockLayout[blockRow][blockColumn]!=0){
						//immovable black blocks are number one. All other greater number are for blocks that can be moved
						if (envBlocks.blockLayout[blockRow][blockColumn] > 1){
							socket.emit('blockTakeRequest', {
								row: blockRow,
								column: blockColumn
							});
						}
					}
				//if the man has something in inventory, then attempt to drop it at the man's location
				}else if (man.inventory > 1){					
					if (envBlocks.blockLayout[blockRow][blockColumn] == 0){
						socket.emit('blockDropRequest', {
							row: blockRow,
							column: blockColumn,
							type: man.inventory
						});
					//if the man's current location already has a block, (i.e. if he's standing on anything) 
					//attempt to place the block above that space in the grid
					}else if (blockRow > 0 && envBlocks.blockLayout[blockRow - 1][blockColumn] == 0){
						socket.emit('blockDropRequest', {
							row: (blockRow - 1),
							column: blockColumn,
							type: man.inventory
						});
					}
				}
			}
		}
		//upon a notification of a successful pickup of a block from the server, add that block to the man's inventory
		socket.on('Pickup', function(pickup){
			man.inventory = pickup;
			switch(pickup){
				case 2:
					invctx.drawImage(imgWhiteBlock, 12.5, 12.5);
					break;
				case 3:
					invctx.drawImage(imgPinkBlock, 12.5, 12.5);
					break;
				case 4:
					invctx.drawImage(imgRedBlock, 12.5, 12.5);
					break;
				case 5:
					invctx.drawImage(imgPurpleBlock, 12.5, 12.5);
					break;
				case 6:
					invctx.drawImage(imgBlueBlock, 12.5, 12.5);
					break;
				case 7:
					invctx.drawImage(imgTealBlock, 12.5, 12.5);
					break;
				case 8:
					invctx.drawImage(imgGreenBlock, 12.5, 12.5);
					break;
				case 9:
					invctx.drawImage(imgYellowBlock, 12.5, 12.5);
					break;
				case 10:
					invctx.drawImage(imgOrangeBlock, 12.5, 12.5);
					break;
				case 11:
					invctx.drawImage(imgBrownBlock, 12.5, 12.5);
					break;
			}
		});
		//uopn notification of a successful block drop from the server, remove the block from the man's inventory
		socket.on('Drop', function(){
			man.inventory = 0;
			invctx.clearRect(0,0,75,75);			
		});
		
		return man;
	}
	
	//This creates the man controlled by the user and adds it to the game objects array
	var userMan = new Man();
	gameObjects.push(userMan);
	
	//This defines the blocks used to make up the environment. It starts as an empty field with a solid ground, but it's replaced
	//by what the server has before gameCycle is actually called.
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
		//This function draws all the blocks.
		draw : function(){
			for (var i = 0; i < envBlocks.blockLayout.length; i++){
				for (var j = 0; j < envBlocks.blockLayout[i].length; j++){
					if (envBlocks.blockLayout[i][j]){
						switch(envBlocks.blockLayout[i][j]){
						case 1:
							ctx.drawImage(imgBlackBlock, 50*j, 50*i);
							break;
						case 2:
							ctx.drawImage(imgWhiteBlock, 50*j, 50*i);
							break;
						case 3:
							ctx.drawImage(imgPinkBlock, 50*j, 50*i);
							break;
						case 4:
							ctx.drawImage(imgRedBlock, 50*j, 50*i);
							break;
						case 5:
							ctx.drawImage(imgPurpleBlock, 50*j, 50*i);
							break;
						case 6:
							ctx.drawImage(imgBlueBlock, 50*j, 50*i);
							break;
						case 7:
							ctx.drawImage(imgTealBlock, 50*j, 50*i);
							break;
						case 8:
							ctx.drawImage(imgGreenBlock, 50*j, 50*i);
							break;
						case 9:
							ctx.drawImage(imgYellowBlock, 50*j, 50*i);
							break;
						case 10:
							ctx.drawImage(imgOrangeBlock, 50*j, 50*i);
							break;
						case 11:
							ctx.drawImage(imgBrownBlock, 50*j, 50*i);
							break;						
						}
					}
				}
			}
		}
	}
	
	//The chat interface object is used to display a pending message that the user is working on
	var chatInterface = {
		active : false,
		displayString : "",
		cursorCount: 0,
		//This function draws the chat interface
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
					//The cursor is actually a vertical line that gets appended to the displayed string depending on the value of cursorCount
					ctx.fillText(chatInterface.displayString + "|", 75, 575);
				}
			}
		},
		//this function updates the cursor count, which is used to control the blinking cursor
		update : function(){
			if (chatInterface.active){
				chatInterface.cursorCount++;
				if (chatInterface.cursorCount >=30){
					chatInterface.cursorCount = 0;
				}
			}
		}
	}
	
	//This function draws a speech bubble of the specified width and height at a specified location
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
	
	//This function performs the canvas transformations that are used to follow the user's character around the play space
	var moveFrame = function(){
		var xTranslate = Math.max(Math.min(-userMan.position[0] + 400, 0), 800 - envBlocks.blockLayout[0].length*50);
		var yTranslate = Math.max(Math.min(-userMan.position[1] + 300, 0), 600 - envBlocks.blockLayout.length*50);
		ctx.translate(xTranslate, yTranslate);
	}
	
	
}

//This is the contructor for the animation object, which is used to break down sprite strips and display them as animations
var Animation = function(image, numFrames, cyclesPerFrame){
	if (!cyclesPerFrame){
		cyclesPerFrame = 1;
	}
	this.width = Math.floor(image.width / numFrames);
	this.height = image.height;
	this.position = [0,0];
	this.currentFrame = 0;
	//this function advances the frame every (cyclesPerFrame) game cycles
	this.update = function(){
		this.currentFrame++;
		if (this.currentFrame >= (numFrames*cyclesPerFrame)){
			this.currentFrame = 0;
		}
	}
	//this function draws the current frame at the animation's current position
	//Note that the animation has it's own position that needs to be updated to match the character or object it represents
	this.draw = function(){
		ctx.drawImage(	image, 
					Math.floor(image.width / numFrames * Math.floor(this.currentFrame/cyclesPerFrame)),
					0,
					this.width,
					this.height,
					this.position[0],
					this.position[1],
					this.width,
					this.height);
	}
}

//This is the constructor for the MaskedAnimation object, which inherits from the Animation object.
//This is used to draw an animation using masks, so that parts of the image may have their colors programmatically controlled.
var RGBAnimation = function(baseImage, redImage, greenImage, blueImage, numFrames, cyclesPerFrame, color){
	var base = new Animation(baseImage, numFrames, cyclesPerFrame);
	base.color = color;
	//drawing different colored characters is acheived by drawing a black base image and then filling in body sections by repeatedly drawing 
	//dark red, green and blue images with the "lighter" global compositing option turned on.
	base.draw = function(){
		ctx.drawImage(	baseImage,
					Math.floor(baseImage.width / numFrames * Math.floor(base.currentFrame/cyclesPerFrame)),
					0,
					base.width,
					base.height,
					base.position[0],
					base.position[1],
					base.width,
					base.height);
		ctx.globalCompositeOperation = 'lighter';
		for (var i = 0; i < color[0]; i++){
			ctx.drawImage(	redImage,
						Math.floor(baseImage.width / numFrames * Math.floor(base.currentFrame/cyclesPerFrame)),
						0,
						base.width,
						base.height,
						base.position[0],
						base.position[1],
						base.width,
						base.height);
		}
		for (var i = 0; i < color[1]; i++){
			ctx.drawImage(	greenImage,
						Math.floor(baseImage.width / numFrames * Math.floor(base.currentFrame/cyclesPerFrame)),
						0,
						base.width,
						base.height,
						base.position[0],
						base.position[1],
						base.width,
						base.height);
		}
		for (var i = 0; i < color[2]; i++){
			ctx.drawImage(	blueImage,
						Math.floor(baseImage.width / numFrames * Math.floor(base.currentFrame/cyclesPerFrame)),
						0,
						base.width,
						base.height,
						base.position[0],
						base.position[1],
						base.width,
						base.height);
		}		
		ctx.globalCompositeOperation = 'source-over';		
	}
	return base;
}
