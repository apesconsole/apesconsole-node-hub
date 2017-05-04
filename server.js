/*
	Apes's Console
*/

var express = require("express");
var app = express();
var http = require('http').Server(app);
var router = express.Router();
var logger = require("logging_component");
var url = require("url");
var mqtt = require('mqtt')



var path = __dirname + '/public/';
app.use('/resources', express.static(path + 'resources'));
app.use("/", router);

var mqtt_url = url.parse(process.env.CLOUDMQTT_URL || 'mqtt://localhost:1883');

// Create a client connection
var publisher = mqtt.connect(mqtt_url , {
  username: process.env.CLOUDMQTT_PUB_UID || '',
  password: process.env.CLOUDMQTT_PUB_PWD || ''
});

var subscriber = mqtt.connect(mqtt_url , {
  username: process.env.CLOUDMQTT_SUB_UID || '',
  password: process.env.CLOUDMQTT_SUB_PWD || ''
});

router.get("/fetch", function(req,res){
	logger.log("Message - fetch");
	publisher.on('connect', function() { // When connected
	// publish a message to a topic
	  publisher.publish('T_APESCONSOLE_TRG', '{roomId: 1,  deviceId: 1, action: "fetch"}', function() {
		logger.log("Message is sent");
		client.end(); // Close the connection when published
	  });
	});	
	res.redirect('/index');
});

router.get("/toggle", function(req,res){
	logger.log("Message - toggle");
	publisher.on('connect', function() { // When connected
	// publish a message to a topic
	  publisher.publish('T_APESCONSOLE_TRG', '{roomId: 1,  deviceId: 1, action: "toggle"}', function() {
		logger.log("Message is sent");
		client.end(); // Close the connection when published
	  });
	});	
	res.redirect('/index');
});

router.get("/refresh", function(req,res){
	// subscribe to a topic
	subscriber.subscribe('T_APESCONSOLE_RD', function() {
		// when a message arrives, do something with it
		subscriber.on('message', function(topic, message, packet) {
			logger.log("Received '" + message + "' on '" + topic + "'");
		});
	});	
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
	logger.log('        Ape\'s Console - NODE - HUB ');
	logger.log('        Process Port :' + process.env.PORT);
	logger.log('        Local Port   :' + 3001);
	logger.log('##################################################');
});	



