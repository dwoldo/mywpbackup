var WPRemote = require( './wpremote-client' );
var apiKey = '3A891BD055ACC83DB99F7C10C25C7499';
var client = new WPRemote( apiKey );

// Perform backup of all websites
client.backup( 's3' );
client.cleanupExpiredBackups( 30, 's3' );
