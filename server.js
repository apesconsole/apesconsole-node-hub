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
var MongoClient  = require('mongodb').MongoClient;

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

var bridge = {
	status		: true, 
	bridgeid	: process.env.CLOUD_BRIDGE_ID || 'ABCD_ID', 
	bridgename	: process.env.CLOUD_BRIDGE_NAME || 'ABCD_NAME', 
	key			: process.env.CLOUD_BRIDGE_KEY || 'ABCD_KEY'
};

var cloudMonGoDBConfig = {
    mongoUri: process.env.MONGODB_URI || ''
}

var loadZoneInfo = function(callBackMethods){
	MongoClient.connect(cloudMonGoDBConfig.mongoUri, function(err, db) {
		db.collection('ZONE_STORE').find( {} ).toArray(function(err, result) {
			db.close();
			if (err) 
				callBackMethods.failure();
			else
				callBackMethods.success(result);
		});
	});
}

var loadDeviceInfo = function( _roomId, callBackMethods){
	MongoClient.connect(cloudMonGoDBConfig.mongoUri, function(err, db) {
		db.collection('ZONE_STORE').find( {roomId: _roomId} ).toArray(function(err, result) {
			db.close();
			if (err) 
				callBackMethods.failure();
			else
				callBackMethods.success(result);
		});
	});
}

subscriber.on('connect', function() { 
    // When connected
	logger.log('MQTT HUB - Ready');
	subscriber.subscribe('T_APESCONSOLE_RD');
	subscriber.on('message', function(topic, message, packet) {
		logger.log("Received feed back from Raspberry Pi ->'" + message.toString());
		//var deviceState = JSON.parse(message.toString());
	});	
});

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
		case 'searchbridge'  : content = searchbridge(req, res); 
		                       res.json(content);
							   break;
		case 'validate'      : content = validate(req, res); 
						       res.json(content);
						       break;
		case 'click'         : content = click(req, res, function(data){
							   res.json(content);
						       break;	
							   
		//Cloud Mongo Asynch Calls Follow
		case 'roomlist'      : roomlist(req, res, function(data){
							      res.json(data);
						      }); break;
		case 'devicelist'    : devicelist(req, res, function(data){
							      res.json(data);
						      }); break;
		/*case 'fetch'         : fetch(req, res, function(data){
							      res.json(data);
						      }); break;*/
	}
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

var roomlist = function(req,res, callBak){
	loadZoneInfo({ 
		success: function(rows){
			callBak(rows);
		}, 
		failure: function(){
			callBak({});
		}
	});
}

var devicelist = function(req,res, callBak){
    var data = {status: false};
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;
	loadDeviceInfo(query.roomId, { 
		success: function(rows){
			callBak(rows);
		}, 
		failure: function(){
			callBak({});
		}
	});
}

var click = function(req,res){
	var data = {status: true};
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;	
	// publish a message to a topic
	publisher.publish(
	    //Topic
		'T_APESCONSOLE_TRG', 
		//Message
		'{"status": "' + query.requestState + '",  "deviceId": "' + query.deviceId + '", "roomId":' + query.roomId + '}'
	);		
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



