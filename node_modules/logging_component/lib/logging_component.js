'use strict';
var logger = exports = module.exports = {};
logger.log = function log(message){
    console.log(new Date().toISOString().
    replace(/T/, ' ').   // replace T with a space
    replace(/\..+/, '')  // delete the dot and everything after
    + ' - ' + message ); // add message string
}