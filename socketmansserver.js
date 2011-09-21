var static = require('node-static');
var http = require('http');

var clientFiles = new static.Server('./client');

var httpServer = http.createServer(function(request, response) {
    request.addListener('end', function () {
        clientFiles.serve(request, response);
    });
});
httpServer.listen(80);

var io = require('socket.io').listen(httpServer);

var Player = function(){
	this.position = new Array(2);
	this.velocity = new Array(2);
}

var players = new Array();

var blocks = [	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
			[2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]];

io.sockets.on('connection', function(socket){
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
	
	socket.broadcast.emit('player joined', {playerIndex: socket.playerIndex});
	
	var existingPlayers = new Array();
	for (var i = 0; i < players.length; i++){
		if (players[i] && i != socket.playerIndex){
			existingPlayers.push(i);
		}
	}		
	socket.emit('existing players', existingPlayers);
	
	socket.emit('environment load', blocks);
	
	socket.on('clientManUpdate', function(data){
		socket.broadcast.emit('serverManUpdate', {
			playerIndex : socket.playerIndex,
			position : data.position,
			velocity : data.velocity,
		});
	});
	
	socket.on('blockTakeRequest', function(data){
		if (blocks[data.row][data.column] == 1){
			blocks[data.row][data.column] = 0;
			socket.emit('Pickup', 1);
			io.sockets.emit('removeBlock', {
				row: data.row,
				column: data.column,
			});
		}
	});
	
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
	
	socket.on('disconnect', function(){
		players[socket.playerIndex] = false;
		socket.broadcast.emit('player left', {playerIndex: socket.playerIndex});
	});
});
