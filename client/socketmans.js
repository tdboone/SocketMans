//This is a place to output messages without having to look at the log
var consoleDiv = document.getElementById('consolediv');

//This idenifies the canvas element
var canvas = document.getElementById('gamecanvas');
var ctx = canvas.getContext('2d');

var images = new Array(); //This is an array used to hold all the images to load
var imageLoaded = new Array(); //This is an array of boolean values used to keep track of whether each image has been loaded

var imgManStill = new Image();
imgManStill.src = 'ManStill.png';
images.push(imgManStill);

var imgGreenBlock = new Image();
imgGreenBlock.src = 'GreenBlock.png';
images.push(imgGreenBlock);

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
	
	var socket = io.connect('http://www.goblynstomp.com');
	
	socket.on('player joined', function(data){
		otherPlayers[data.playerIndex] = new Man();
		emitUpdate();
	});
	
	socket.on('existing players', function(existingPlayers){
		for (var i = 0; i < existingPlayers.length; i++){
			otherPlayers[existingPlayers[i]] = new Man();
		}
	});
	
	socket.on('player left', function(data){
		delete otherPlayers[data.playerIndex];
	});
	
	function emitUpdate(){
		if (userMan){
			socket.emit('clientManUpdate', {
				position : userMan.position,
				velocity: userMan.velocity,
			});
		}
	}
	
	socket.on('serverManUpdate', function(data){
		otherPlayers[data.playerIndex].position = data.position;
		otherPlayers[data.playerIndex].velocity = data.velocity;
	});
	
	
	gameCycle();
	
	//This is the basic cycle that is constantly repeating for the game to work. The timeouts are adjusted to make sure the 
	//frame rate stays at around 30 fps (I don't want to use setInterval, b/c if a cycle takes longer than 35msec it may cause
	//two game cycles to run at once)
	function gameCycle(){
		var startTime = new Date();
		gameUpdate();
		gameDraw();
		var endTime = new Date();
		var t = (endTime.getTime() - startTime.getTime() < 35) ? 35 - (endTime.getTime() - startTime.getTime()) : 0;
		window.setTimeout(gameCycle, t);
		consoleDiv.innerHTML = "extra cycle time: " + t +"msec";
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
	}
	
	//This function clears the canvas and draws the current frame.
	function gameDraw(){
		ctx.clearRect(0, 0, 800, 600);
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
	}
	
	//This and the onkeyup functions are where you implement the controls.
	window.onkeydown = function(event){
		if (event.keyCode){
			switch(event.keyCode)
			{
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
				//case 65:
				//	extraMan.moveLeftStart();
				//	event.preventDefault();
				//	break;
				//case 68:
				//	extraMan.moveRightStart();
				//	event.preventDefault();
				//	break;
				//case 87:
				//	extraMan.jump();
				//	event.preventDefault();
				//	break;
			}
		}else if(event.key){
			switch(event.key)
			{
				case 37:
					userMan.moveLeftStart();
					emitUpdate();
					event.preventDefault();
					break;
				case 38:
					userMan.jump();
					emitUpdate();
					event.preventDefault();
				case 39:
					userMan.moveRightStart();
					emitUpdate();
					event.preventDefault();
					break;
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
				//case 65:
				//	extraMan.moveLeftStop();
				//	break;
				//case 68:
				//	extraMan.moveRightStop();
				//	break;
			}
		}else if(event.key){
			switch(event.key)
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
		man.position = [400, 200];
		man.width = 34;
		man.height = 49;
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
			
			if (man.position[0] + man.width <= 800){
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
				man.position[0] = 800 - man.width;
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
		}
		man.draw = function(){
			ctx.drawImage(imgManStill, man.position[0], man.position[1], man.width, man.height);
		}
		man.jump = function(){
			man.velocity[1] = -18;
		}
		man.moveRightStart = function(){
			man.velocity[0] += 5;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 5), -5);
		}
		man.moveRightStop = function(){
			man.velocity[0] -= 5;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 5), -5);
		}
		man.moveLeftStart = function(){
			man.velocity[0] += -5;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 5), -5);
		}
		man.moveLeftStop = function(){
			man.velocity[0] += 5;
			man.velocity[0] = Math.max(Math.min(man.velocity[0], 5), -5);
		}
		
		return man;
	}
	
	var userMan = new Man();
	gameObjects.push(userMan);
	
	//var extraMan = new Man();
	//gameObjects.push(extraMan);
	
	//This defines the blocks used to make up the environment
	var envBlocks = {
		blockLayout : [	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
					[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
					[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0],
					[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
					[0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
					[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
		draw : function(){
			for (var i = 0; i < envBlocks.blockLayout.length; i++){
				for (var j = 0; j < envBlocks.blockLayout[i].length; j++){
					if (envBlocks.blockLayout[i][j]){
						ctx.drawImage(imgGreenBlock, 50*j, 50*i);
					}
				}
			}
		}
	}
}
