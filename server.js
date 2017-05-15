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

/*
	Cloud MongoDB Based Security & Operations
*/
var bodyParser   = require('body-parser');
var cookieParser = require('cookie-parser');
var session      = require('express-session');
var MongoStore   = require('connect-mongo')(session);
var MongoClient  = require('mongodb').MongoClient;
app.use(bodyParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
//MongoDB Connection Details
var cloudMonGoDBConfig = {
    mongoUri: process.env.MONGODB_URI || 'mongodb:///heroku_iot_data',
	mongoUsr: process.env.MONGODB_USR || 'mongodb:///heroku_iot_user',
	mongoSession: process.env.MONGODB_SESSION_URL || 'mongodb:///heroku_session' 
}
var mongoose = require('mongoose');
mongoose.connect(cloudMonGoDBConfig.mongoSession);
var sessionStore = new MongoStore({mongooseConnection: mongoose.connection });
	
app.use(session({
    cookie: { maxAge: 1000*60*30 } ,
	//This is the Secret Key
    secret: "apesconsole session secret code",
    store: sessionStore
}));

var path = __dirname + '/public/';
app.use('/resources', express.static(path + 'resources'));
app.use("/", router);

var mqtt_url = url.parse(process.env.CLOUDMQTT_URL || 'tcp://m13..com:');
// Create a client connection
var publisher = mqtt.connect(mqtt_url , {
	username: process.env.CLOUDMQTT_PUB_UID || '',
	password: process.env.CLOUDMQTT_PUB_PWD || ''
});

var subscriber = mqtt.connect(mqtt_url , {
	username: process.env.CLOUDMQTT_SUB_UID || '',
	password: process.env.CLOUDMQTT_SUB_PWD || ''
});

var reseter = mqtt.connect(mqtt_url , {
	username: process.env.CLOUDMQTT_SUB_UID || '',
	password: process.env.CLOUDMQTT_SUB_PWD || ''
});

var bridge = {
	status		: true, 
	bridgeid	: process.env.CLOUD_BRIDGE_ID || '', 
	bridgename	: process.env.CLOUD_BRIDGE_NAME || '', 
	key			: process.env.CLOUD_BRIDGE_KEY || ''
};

var userValidatoin = function(user, callBackMethods){
	MongoClient.connect(cloudMonGoDBConfig.mongoUsr, function(err, db) {
		db.collection('USERS').findOne( user, function(err, result) {
			db.close();
			if (err || null == result || null == result.userId) 
				callBackMethods.failure();
			else
				callBackMethods.success(result)
		});
	});
}

var loadZoneInfo = function(callBackMethods){
	MongoClient.connect(cloudMonGoDBConfig.mongoUri, function(err, db) {
		db.collection('ZONE_STORE').find( {}, {title: 1, roomId: 1, icon: 1 } ).toArray(function(err, result) {
			db.close();
			if (err) 
				callBackMethods.failure();
			else
				callBackMethods.success(result);
		});
	});
}

var loadDeviceInfo = function( criteria, callBackMethods){
	MongoClient.connect(cloudMonGoDBConfig.mongoUri, function(err, db) {
		db.collection('DEVICE_STORE').find( criteria ).toArray(function(err, result) {
			db.close();
			if (err) 
				callBackMethods.failure();
			else
				callBackMethods.success(result);
		});
	});
}

var resetAllDevices =  function(){
	MongoClient.connect(cloudMonGoDBConfig.mongoUri, function(err, db) {
	    //Update all Devices
		db.collection('DEVICE_STORE').update({status: true, active: "active"}, {$set: {status: false}}, {multi: true}, function(err, opt) {
			db.close();
			logger.log('Mongo Update');
		});
	});
}

var updateDeviceInfo = function( _device ){
    logger.log('Device Update Attemted for - ' + _device.deviceId);
	loadDeviceInfo({deviceId: _device.deviceId}, { 
		success: function(device){
			logger.log('Device Detection - ' + device.length);
			if(device.length == 1) {
				var data = {
					status: _device.status == 1 ? true : (_device.status == 0 ) ? false : ( _device.status ) 
				};
				logger.log(device[0].type);
				if(device[0].type == "S"){
					//Sensor Data
					data.color = _device.status ? 'green' : 'red';
					data.value  = _device.value;
				}
				
				logger.log(data.value);
				MongoClient.connect(cloudMonGoDBConfig.mongoUri, function(err, db) {
					db.collection('DEVICE_STORE').update( {deviceId: _device.deviceId}, {$set: data}, function(err, opt) {
						db.close();
						logger.log(opt);
					});
				});
			} else {
				logger.log('Device Not Found - Device Id:' + _device.deviceId);
			}
		}, 
		failure: function(){
			logger.log('Device Update Failed - Device Id:' + _device.deviceId);
		}
	});
}

reseter.on('connect', function() { 
	reseter.subscribe('T_APESCONSOLE_RESET');
	reseter.on('message', function(topic, message, packet) {
		logger.log("Raspberry Pi Restart Detected ->'" + message.toString());
		//Asynch Reset Update to all Device Shut Down. I don't care of the call back
		resetAllDevices();
	});
});

subscriber.on('connect', function() { 
    // When connected
	logger.log('MQTT HUB - Ready');
	subscriber.subscribe('T_APESCONSOLE_RD');
	subscriber.on('message', function(topic, message, packet) {
		logger.log("Received feed back from Raspberry Pi ->'" + message.toString());
		var deviceState = JSON.parse(message.toString());
		//Asynch Update. I don't care of the call back
		updateDeviceInfo(deviceState);
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
		case 'click'         : content = click(req, res);
							   res.json(content);
						       break;	
							   
		//Cloud Mongo Asynch Calls Follow
		case 'roomlist'      : roomlist(function(data){
							      res.json(data);
						      }); break;
		case 'devicelist'    : var _roomId = query.roomId;
							   devicelist(_roomId, function(data){
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

var roomlist = function(callBak){
	loadZoneInfo({ 
		success: function(rooms){
			callBak(rooms);
		}, 
		failure: function(){
			callBak({});
		}
	});
}

var devicelist = function(_roomId, callBak){
	loadDeviceInfo({roomId: eval(_roomId)}, { 
		success: function(devices){
			callBak(devices);
		}, 
		failure: function(){
			callBak({});
		}
	});
}

var click = function(req,res){
	var data = {status: false};
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;	
	// publish a message to a topic
	if('undefined' == query.requestState || undefined == query.requestState) return {status: false};
	var message = '{"status": "' + query.requestState + '",  "deviceId": "' + query.deviceId + '", "roomId":' + query.roomId + '}'
	logger.log('Pub Message->' + message);
	publisher.publish(
	    //Topic
		'T_APESCONSOLE_TRG', 
		//Message
		message
	);		
	data.state = true;
	return data;
}

app.get("/getuser", function(req,res){
	logger.log('req.session.userId = '+ req.session.userId);
	if(req.session.userId != undefined)
		res.json({'name': req.session.name});
	else res.json({});
});

/*
	Get Method not Allowed for authentication
*/
app.get("/auth", function(req, res){
	res.redirect('/login');
});

app.post("/auth", function(req, res){
	if(null != req.body.userId && null != req.body.password && '' != req.body.userId && '' != req.body.password){
	    userValidatoin( {
		        //User Entered Information
				userId: req.body.userId, 
				password:req.body.password
			}, { 
				//If Valid User Call 
				success: function(userInfo){
					req.session.userId = userInfo.userId;
					req.session.name = userInfo.name;
					res.redirect('/home');
				}, 
				//If In-Valid User Call 
				failure: function(){
					res.redirect('/login');
				}
			}
		);
	} else {
		res.redirect('/login');
	}
});	


//All URL Patterns Routing

app.get("/", function(req,res){
	if(null != req.session.name){
		res.redirect('/home');
	} else {
		res.redirect('/login');
	}
});

app.get("/login", function(req,res){
	if(null != req.session || undefined != req.session)
		req.session.destroy();
	res.sendFile(path + "login.html");
});	

app.get("/home", function(req,res){
	if(req.session.name == undefined)
		res.redirect('/login');
	else res.sendFile(path + "home.html");
});

app.get("/zone", function(req,res){
	if(req.session.name == undefined)
		res.redirect('/login');
	else res.sendFile(path + "zone.html");
});

app.get("/logout", function(req,res){
	res.redirect('/login');
});


http.listen(process.env.PORT || 3001, () => {				
	logger.log('##################################################');
	logger.log('        Ape\'s Console - NODE - HUB | Heroku');
	logger.log('        Process Port :' + process.env.PORT);
	logger.log('        Local Port   :' + 3001);
	logger.log('##################################################');
});	



