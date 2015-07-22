var WPRemote = require('./wpremote-client');
var apiKey = '3A891BD055ACC83DB99F7C10C25C7499';
var client = new WPRemote(apiKey);

// Perform backup of all websites
client.backup('s3');
// WPRemote(apiKey).backup('s3', 12334);

// Make RESTful requests
// client.get('site').on('success', function(body, response) {
//
// }).on('fail', function(body, response) {
//     console.log("fail", response.statusCode, response.req.path);
// });
//
// var backup = function(siteId, location) {
//
// };
