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
	
	socket.on('clientManUpdate', function(data){
		socket.broadcast.emit('serverManUpdate', {
			playerIndex : socket.playerIndex,
			position : data.position,
			velocity : data.velocity,
		});
	});
	
	socket.on('disconnect', function(){
		players[socket.playerIndex] = false;
		socket.broadcast.emit('player left', {playerIndex: socket.playerIndex});
	});
});
