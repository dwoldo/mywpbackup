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

function waitForArchiveCreation(site, location, callback, timeout, frequency) {
    timeout = (_.isUndefined(timeout) ? 60000 : timeout);
    frequency = (_.isUndefined(frequency) ? 2000 : frequency);
    var start = new Date();

    // Check for a download URL ever
    var checking = false;
    var checkForArchiveCreationComplete = function() {
        checking = true;
        // check if timeout has been reached
        if ((Math.abs(new Date() - start)) <= timeout) {
            // check on archive creation status
            makeRequest('get', site.ID + '/download', function(body, response) {
                // respond with archive URL
                if (body.status == 'backup-complete') {
                    clearInterval(interval);
                    console.log('Backup created for', site.url, 'and can be downloaded at:', body.url);
                    checking = false;
                    callback(site, body.url, location);
                }
            });
            checking = false;
        } else {
            console.log("Timeout for archive creation expired");
            // timeout reached
            checking = false;
            clearInterval(interval);
        }
    };
    // Set frquency
    var interval = setInterval(checkForArchiveCreationComplete, frequency);
    checkForArchiveCreationComplete();
}

var copyArchiveToRemote = function(site, archiveFileURL, location, callback) {
    var instance = require(path.resolve('backup_modules', location.name));
    var backupInstance = new instance(location);

    var cbComplete = function(site, File) {
        console.log(File);
        console.log('Backup archive uploaded to remote server');
        deleteSingleSiteArchive(site, File);
    };

    if (!_.isUndefined(callback)) cbComplete = callback;

    backupInstance.upload(archiveFileURL, cbComplete);
};

var deleteSingleSiteArchive = function(site, File, done) {
    makeRequest('del', site.ID + '/download', function(body, response) {
        console.log('Deleted original website backup for:', site.url);
        done();
    });
};

var backupArchive = function(site, location) {
    // Eventually we will attached location backup workflow to the actual location object
    waitForArchiveCreation(site, location, copyArchiveToRemote);
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

function archiveSingleSite(site, location, callback) {
    makeRequest('post', site.ID + '/download', function(body, response) {
        console.log('Archive creation in progress for:', site.url);

        callback(site, location);
    });
}

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

    // Convert numbers to string
    uri = uri.toString();

    // Overrideable Callback
    var defaultCallback = {
        error: function(err, response) {
            throw new Error(err);
        },
        fail: function(data, response) {
            if (response.statusCode >= 400) {
                throw new Error(response.req.method + ' Status is ' +
                    response.statusCode + ' for URL: ' + getRequestURL(response));
            }
        },
        timeout: function(ms) {
            throw new Error("Request timed out after: " + ms);
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


function mixin(target, source) {
    source = source || {};
    Object.keys(source).forEach(function(key) {
        target[key] = source[key];
    });

    return target;
}

// Set the available methods to be exported
mixin(methods, {
    backup: archive,
    _makeRequest: makeRequest,
    _archiveSingleSite: archiveSingleSite,
    _getSites: getSites,
    _doArchive: doArchive,
    _copyArchiveToRemote: copyArchiveToRemote,
    _waitForArchiveCreation: waitForArchiveCreation,
    _deleteSingleSiteArchive: deleteSingleSiteArchive

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
