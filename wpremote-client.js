var restler = require('restler');
var _ = require('lodash');
var url = require('url');
var async = require('async');
var backupLocations = require('./backup_locations.json');
var apiURL = 'https://wpremote.com/api/json/site/';
var path = require('path');
var methods = {};
var remote;

function checkBackupDownloadURL(site, callback, timeout, frequency) {
    timeout = (_.isUndefined(timeout) ? 60000 : timeout);
    frequency = (_.isUndefined(frequency) ? 2000 : frequency);
    var start = new Date();

    // Check for a download URL ever
    var interval = setInterval(function() {
        // check if timeout has been reached
        if ((Math.abs(new Date() - start)) <= timeout) {
            // check on archive creation status
            remote.get(site.ID + '/download').on('success', function(body, response) {
                // respond with archive URL
                if (body.status == 'backup-complete') {
                    clearInterval(interval);
                    callback(site, body.url);
                } else {
                    console.log(site.url, 'has a backup status of:', body.status);
                }
            });
        } else {
            console.log("Timeout for archive creation expired");
            // timeout reached
            clearInterval(interval);
        }
    }, frequency);
}

var backupArchive = function(site, location) {
    // Eventually we will attached location backup workflow to the actual location object
    var callback = function(site, archiveFileURL) {
        console.log('This website:', site.url, 'has been backed up and the archive can be downloaded at:', archiveFileURL);

        var cbFinished = function(error, response) {
            console.log('Upload finished to', location.name, 'for site', site.url);
            if (error)
                console.log('cbFinished with error', error);

            remote.del(site.ID + '/download').on('success', function(body, response) {
                console.log('Deleted backup for:', site.url);
            });
        };

        var backupInstance = require(path.resolve('backup_modules', location.name));
        backupInstance.init(location);
        backupInstance.upload(archiveFileURL, cbFinished);
    };

    checkBackupDownloadURL(site, callback);
};

function archive(locationId, siteId) {
    var location = _.get(backupLocations, locationId, {});
    getSites(doArchive.bind(null, location, backupArchive), siteId);
}


var doArchive = function(location, callback, sites) {
    if (!_.isUndefined(location) && !_.isUndefined(sites)) {
        sites.forEach(function(site) {
            archiveSingleSite(site, location, callback);
        });
    }
};

function getSites(callback, siteId) {
    var path = !_.isUndefined(siteId) ? siteId : '';
    remote.get(path).on('success', function(body, response) {
        // Always pass an array of object(s) to call back
        if (_.isArray(body)) {
            callback(body);
        } else if (_.isPlainObject(body)) {
            callback([body]);
        } else {
            console.log("Unknown response, cannot continue");
        }
    });
}

function archiveSingleSite(site, location, callback) {
    remote.post(site.ID + '/download').on('success', function(body, response) {
        console.log('Archive creation in progress for:', site.url);

        callback(site, location);
    });
}

function mixin(target, source) {
    source = source || {};
    Object.keys(source).forEach(function(key) {
        target[key] = source[key];
    });

    return target;
}

// Set the available methods to be exported
mixin(methods, {
    backup: archive
});

var WPRemote = restler.service(function(apiKey) {
    if (!_.isUndefined(apiKey)) {
        this.defaults.username = apiKey;
        this.defaults.password = '';
        remote = this;
    } else {
        console.log("Missing API Key");
    }
}, {
    baseURL: apiURL
}, methods);

module.exports = WPRemote;
