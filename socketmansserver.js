//This section sets up the static content server
var static = require('node-static');
var http = require('http');

var clientFiles = new static.Server('./client');

var httpServer = http.createServer(function(request, response) {
    request.addListener('end', function () {
        clientFiles.serve(request, response);
    });
});
httpServer.listen(80);

//Here's where the web socket stuff starts:

var io = require('socket.io').listen(httpServer);

//he Player object is used to keep track of the last reported position and velocity of each player
var Player = function(){
	this.position = new Array(2);
	this.velocity = new Array(2);
}

//This is the array that the server uses to keep track of all the game's current players
var players = new Array();

//This is the array that defines the play space when the server starts
var blocks = [	[00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 07, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00],
			[00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 07, 07, 00, 00, 00, 00, 00, 00, 06, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00],
			[00, 00, 00, 00, 00, 02, 02, 00, 00, 00, 00, 07, 07, 07, 07, 00, 00, 00, 00, 00, 06, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00],
			[00, 00, 00, 00, 02, 02, 02, 02, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 06, 06, 06, 06, 06, 06, 00, 00, 00, 00, 00, 00, 00],
			[00, 00, 00, 02, 02, 02, 02, 02, 00, 00, 00, 00, 00, 00, 00, 00, 00, 06, 06, 06, 06, 06, 06, 06, 06, 06, 06, 00, 00, 00, 00, 00],
			[00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 03],
			[02, 02, 00, 00, 00, 00, 00, 00, 00, 00, 02, 02, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 03, 03],
			[00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 03, 03, 03],
			[00, 00, 02, 02, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 04, 04, 00, 09, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 03, 03],
			[00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 04, 04, 00, 09, 09, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 03],
			[02, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00],
			[00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 08, 08, 08, 00, 00, 00, 00, 00, 00, 00, 09, 09, 09, 00, 00, 00, 00, 00, 00, 00],
			[00, 08, 06, 06, 06, 06, 06, 08, 00, 00, 00, 08, 11, 11, 11, 08, 00, 00, 00, 09, 09, 00, 00, 00, 00, 00, 00, 00, 05, 05, 05, 05],
			[00, 08, 06, 06, 06, 06, 06, 08, 00, 00, 00, 08, 09, 09, 09, 08, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 05, 05],
			[11, 08, 08, 08, 08, 08, 08, 08, 11, 00, 00, 08, 11, 11, 11, 08, 00, 00, 04, 10, 04, 10, 04, 10, 04, 10, 04, 10, 04, 00, 05, 05],
			[01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01, 01]];


io.sockets.on('connection', function(socket){
	//When a new player connects, this function searches the players array for an empty spot to put the current player in.
	//If it doesn't find one, it adds a new element to the players array.
	var indexSet = false;		
	for (var i = 0; i < players.length; i ++){
		if (!players[i])
		{
			players[i] = new Player();
			socket.playerIndex = i;
			indexSet = true;
			i = players.length;
		}
	}
	if (!indexSet){
		players.push(new Player());
		socket.playerIndex = players.length - 1;
	}
	
	//This communicates to every other client that a new player has joined. This triggers each client to emit an update to their current position and velocity
	socket.broadcast.emit('player joined', {playerIndex: socket.playerIndex});
	
	//This communicates to the joining player all the existing players that are currently playing
	var existingPlayers = new Array();
	for (var i = 0; i < players.length; i++){
		if (players[i] && i != socket.playerIndex){
			existingPlayers.push(i);
		}
	}		
	socket.emit('existing players', existingPlayers);
	
	//Send the user the current colors and names of each of the existing users
	for (var i = 0; i < existingPlayers.length; i++){
		if (players[existingPlayers[i]].color){
			socket.emit('shareUserColor', {
				playerIndex : existingPlayers[i],
				color: players[existingPlayers[i]].color
			});
		}
		if (players[existingPlayers[i]].name){
			socket.emit('shareUserName', {
				playerIndex : existingPlayers[i],
				name: players[existingPlayers[i]].name
			});
		}
	}
	
	//This sends the joining player the array that keeps track of the blocks currently in the play space
	socket.emit('environment load', blocks);
	
	//When a client emits an update to their character's location and velocity, that update is then shared with all other players
	socket.on('clientManUpdate', function(data){
		socket.broadcast.emit('serverManUpdate', {
			playerIndex : socket.playerIndex,
			position : data.position,
			velocity : data.velocity,
		});
	});
	
	//When a user emits their character's color, share that color with all other connected players and store it
	//in that character's Player object in the server's players array to share with new connecting players
	socket.on('emitUserColor', function(data){
		players[socket.playerIndex].color = data.color;
		socket.broadcast.emit('shareUserColor', {
			playerIndex : socket.playerIndex,
			color: data.color
		});
	});
	
	//When a user emits their character's name, share that name with all other connected players and store it
	//in that character's Player object in the server's players array to share with new connecting players
	socket.on('emitUserName', function(data){
		players[socket.playerIndex].name = data.name;
		socket.broadcast.emit('shareUserName', {
			playerIndex : socket.playerIndex,
			name: data.name
		});
	});
	
	//When a client emits a message, that message is shared with all other players so that the message is displayed above the representation of their character
	socket.on('sendMessage', function(messageToShare){
		socket.broadcast.emit('shareMessage', {
			playerIndex : socket.playerIndex,
			message : messageToShare	
		});
	});
	
	//When a client's character attempts to pick up a block, a check is sent to the server to ensure that if that block is still there, then the client making the
	//equest picks up that block. This is to prevent block duplication when two clients attempt to pick up the same block at the same time.
	socket.on('blockTakeRequest', function(data){
		if (blocks[data.row][data.column] > 1){
			var blockType = blocks[data.row][data.column];
			blocks[data.row][data.column] = 0;
			socket.emit('Pickup', blockType);
			io.sockets.emit('removeBlock', {
				row: data.row,
				column: data.column,
			});
		}
	});
	
	//Similar to the blockTakeRequest, when a client attempts to drop a block a check is made to the server to ensure that two clients don't drop something in the same place
	//at the same time
	socket.on('blockDropRequest', function(data){
		if (blocks[data.row][data.column] == 0){
			blocks[data.row][data.column] = data.type;
			socket.emit('Drop');
			io.sockets.emit('addBlock', {
				row: data.row,
				column: data.column,
				type: data.type,
			});
		}
	});
	
	//When a player disconnects, a message is emitted to all remeaining players so that they no longer display that character
	socket.on('disconnect', function(){
		players[socket.playerIndex] = false;
		socket.broadcast.emit('player left', {playerIndex: socket.playerIndex});
	});
});
