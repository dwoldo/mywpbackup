var restler = require('restler');
var _ = require('lodash');
var url = require('url');
var async = require('async');
var backupLocations = require('./backup_locations.json');
var apiURL = 'https://wpremote.com/api/json/site/';
var path = require('path');
var i18n = require("i18n");
var methods = {};
var remote;

i18n.configure({
    locales: ['en'],
    directory: __dirname + '/locales',
    defaultLocale: 'en',
});

// Sets language function
__ = i18n.__;


function checkBackupDownloadURL(site, callback, timeout, frequency) {
    timeout = (_.isUndefined(timeout) ? 60000 : timeout);
    frequency = (_.isUndefined(frequency) ? 2000 : frequency);
    var start = new Date();

    // Check for a download URL ever
    var interval = setInterval(function() {
        // check if timeout has been reached
        if ((Math.abs(new Date() - start)) <= timeout) {
            // check on archive creation status
            makeRequest('get', site.ID + '/download', function(body, response) {
                // respond with archive URL
                if (body.status == 'backup-complete') {
                    clearInterval(interval);
                    callback(site, body.url);
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
        console.log('Backup created for', site.url, 'and can be downloaded at:', archiveFileURL);

        var cbFinished = function(error, response) {
            makeRequest('del', site.ID + '/download', function(body, response) {
                console.log('Deleted backup for:', site.url);
            });

            if (error) {
                throw error;
            } else {
                console.log('Upload finished for', site.url, 'at location:', location.name);
            }
        };

        var backupInstance = require(path.resolve('backup_modules', location.name));
        backupInstance.init(location);
        backupInstance.upload(archiveFileURL, cbFinished);
    };

    checkBackupDownloadURL(site, callback);
};

function getRequestURL(response) {
    return url.resolve(apiURL, response.req.path);
}

function archive(locationId, siteId) {
    var location = _.get(backupLocations, locationId, null);

    if (!location)
        throw new Error(__('missing %s', 'location id'));

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
    var uri = !_.isUndefined(siteId) ? siteId : '';
    makeRequest('get', uri, function(body, response) {
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

function makeRequest(type, uri, successCallback, additionalCallbacks) {
    if (!_.isFunction(successCallback))
        throw new Error(__('missing %s', 'successCallback'));

    // Overrideable Callback
    var defaultCallback = {
        error: function(err, response) {
            console.log(err);
        },
        fail: function(data, response) {
            if (response.statusCode >= 400)
                console.log('Status is', response.statusCode, 'for URL:', getRequestURL(response));
        },
        timeout: function(ms) {
            console.log("Request timed out after:", ms);
        },
        complete: function(result, response) {},
    };

    // Override Default callbacks if provided
    _(defaultCallback).forEach(function(callback, type) {
        if (_.has(additionalCallbacks, type)) {
            defaultCallback[type] = additionalCallbacks[type];
        }
    });

    // Execute call and attached callbacks
    remote[type](uri)
        .on('success', successCallback)
        .on('error', defaultCallback.error)
        .on('fail', defaultCallback.fail)
        .on('timeout', defaultCallback.timeout)
        .on('complete', defaultCallback.complete);
}

function archiveSingleSite(site, location, callback) {
    makeRequest('post', site.ID + '/download', function(body, response) {
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
