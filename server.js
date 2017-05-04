/*
	Apes's Console
*/

var express = require("express");
var app = express();
var http = require('http').Server(app);
var router = express.Router();
var logger = require("logging_component");
var url = require("url");
var mqtt = require('mqtt');

var path = __dirname + '/public/';
app.use('/resources', express.static(path + 'resources'));
app.use("/", router);

var mqtt_url = url.parse(process.env.CLOUDMQTT_URL || 'tcp://localhost:0000');
// Create a client connection
var publisher = mqtt.connect(mqtt_url , {
  username: process.env.CLOUDMQTT_PUB_UID || '',
  password: process.env.CLOUDMQTT_PUB_PWD || ''
});

var subscriber = mqtt.connect(mqtt_url , {
  username: process.env.CLOUDMQTT_SUB_UID || '',
  password: process.env.CLOUDMQTT_SUB_PWD || ''
});

subscriber.on('connect', function() { // When connected
	subscriber.subscribe('T_APESCONSOLE_RD');
	subscriber.on('message', function(topic, message, packet) {
		var deviceState = JSON.parse(message);
		logger.log("Received '" + message + "' on '" + topic + "'");
		for(var i=0; i<globalRoomData.length; i++){
			if(globalRoomData[i].id == deviceState.roomId){
				for(var j=0;j<globalRoomData[i].deviceList.length;j++){
					if(globalRoomData[i].deviceList[j].id == deviceState.deviceId){
						globalRoomData[i].deviceList[j].status = deviceState.status;
						i = globalRoomData.length; break;
					}
				}
			}
		}
	});	
});

var bridge = {
	status		: true, 
	bridgeid	: process.env.CLOUD_BRIDGE_ID || 'ABCD_ID', 
	bridgename	: process.env.CLOUD_BRIDGE_NAME || 'ABCD_NAME', 
	key			: process.env.CLOUD_BRIDGE_KEY || 'ABCD_KEY'
};

var globalRoomData = [
	{ title: 'Hall', id: 1, icon: 'hall', deviceList: [
		{ title: 'Lamp', id: 'hall-light1' , status: false},
		{ title: 'AC', id: 'random-1' , status: false},
		{ title: 'Music', id: 'random-2' , status: false},
		{ title: 'Garden', id: 'sensor-status' , status: false}
	]},
	{ title: 'Master Room', id: 2, icon: 'master', deviceList: [
		{ title: 'Light', id: 'mstrm-light1' , status: false},
		{ title: 'Music', id: 'random-3' , status: false},
		{ title: 'Heater', id: 'random-4' , status: false}						
	]},
	{ title: 'Guest Room', id: 3, icon: 'guest', deviceList: [
		{ title: 'Light', id: 'gstrm-light1' , status: false}						
	]}
];


router.use(function (req, res, next) {
	var headers = req.headers;
	var userAgent = headers['user-agent'];
	logger.log('User Agent - ' + userAgent + ', Request - ' + req.method);
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

router.get("/appaccess", function(req,res){
	var content = {};
	var headers = req.headers;
	var userAgent = headers['user-agent'];	
	logger.log('User Agent - ' + userAgent + ', Request - ' + req.method );
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");	
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;
	switch(query.action){
		case 'searchbridge': content = searchbridge(req, res); break;
		case 'validate': content = validate(req, res); break;
		case 'roomlist': content = roomlist(req, res); break;
		case 'devicelist': content = devicelist(req, res); break;
		case 'click': content = click(req, res); break;
		case 'fetch': content = fetch(req, res); 
	}
	res.json(content);
});


var searchbridge = function(req,res){
	return bridge;
}

var validate = function(req,res){
    var data = {status: false};
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;	
	if(query.id == bridge.bridgeid && query.key == bridge.key){
		data.status = true;
	}
	return data;
}

var roomlist = function(req,res){
	return globalRoomData;
}

var devicelist = function(req,res){
    var data = {status: false};
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;		
	for(var i=0; i<globalRoomData.length; i++){
		if(globalRoomData[i].id == query.roomId){
			data = globalRoomData[i].deviceList;
			break;
		}
	}
	return data;
}

var click = function(req,res){
	var data = {status: true};
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;	
	// publish a message to a topic
	publisher.publish('T_APESCONSOLE_TRG', '{action: "click",  deviceId: ' + query.deviceId + ', roomId:' + query.roomId + '}');		
	return data;
}

router.get("/shut", function(req,res){
	logger.log("Shutting Down");
	publisher.end();
	subscriber.end();	
	res.redirect('/index');
});

router.get("/", function(req,res){
	res.redirect('/index');
});

router.get("/index", function(req,res){
	res.sendFile(path + "index.html");
});	

http.listen(process.env.PORT || 3001, () => {				
	logger.log('##################################################');
	logger.log('        Ape\'s Console - NODE - HUB | Heroku');
	logger.log('        Process Port :' + process.env.PORT);
	logger.log('        Local Port   :' + 3001);
	logger.log('##################################################');
});	



