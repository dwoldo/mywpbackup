var restler = require('restler');
var _ = require('lodash');
var url = require('url');
var backupLocations = require('./backup_locations.json');
var apiURL = 'https://wpremote.com/api/json/site/';
var path = require('path');
var i18n = require("i18n");
var LOG = require(path.resolve('utils', 'log.js'));
var methods = {};
var remote;

i18n.configure({
    locales: ['en'],
    directory: __dirname + '/locales',
    defaultLocale: 'en',
});

// Sets language function
__ = i18n.__;

function waitForArchiveCreation(site, onArchiveCreated, timeout, frequency) {
    timeout = (_.isUndefined(timeout) ? 60000 : timeout);
    frequency = (_.isUndefined(frequency) ? 2000 : frequency);

    var start = new Date();
    var finished = function(site, url) {
        clearInterval(interval);
        onArchiveCreated(site, url);
    };

    var interval = setInterval(function() {
        if ((Math.abs(new Date() - start)) <= timeout) {
            getArchiveURL(site, finished);
        } else {
            LOG("Timeout for archive creation expired");
            // timeout reached
            clearInterval(interval);
        }
    }, frequency);

    getArchiveURL(site, finished);

}

var getArchiveURL = function(site, callback) {
    // get archive creation status
    makeRequest('get', site.ID + '/download', function(body, response) {
        // respond with archive URL
        if (body.status == 'backup-complete') {
            LOG('Backup created for', site.url, 'and can be downloaded at:', body.url);
            callback(site, body.url);
        }
    });
};

var copyArchiveToRemote = function(site, archiveFileURL, location, callback) {
    LOG('Attempting to copy the archive for', site.url, 'to remote');
    var instance = require(path.resolve('backup_modules', location.name));
    var backupInstance = new instance(location);

    backupInstance.upload(archiveFileURL, callback);
};

var deleteSingleSiteArchive = function(site, File, callback) {
    makeRequest('del', site.ID + '/download', function(body, response) {
        LOG('Deleted original website backup for:', site.url);
        if (typeof callback == 'function') callback(site, File);
    });
};

var backupArchive = function(site, location, body) {
    // Eventually we will attached location backup workflow to the actual location object
    var finished = function(site, fileArchiveURL) {
        var onArchiveUploaded = function(File) {
            LOG('Backup archive uploaded to remote server for', site.url);
            deleteSingleSiteArchive(site, File);
        };

        copyArchiveToRemote(site, fileArchiveURL, location, onArchiveUploaded);
    };

    waitForArchiveCreation(site, finished);
};

function getRequestURL(response) {
    return url.resolve(apiURL, response.req.path);
}

function archive(locationId, siteId) {
    var location = _.get(backupLocations, locationId, null);

    if (!location)
        throw new Error(__('missing %s', 'location id'));

    // What to do after getting a site or array of sites
    var callback = function(location, sites) {
        sites.forEach(function(site) {
            archiveSingleSite(site, location, backupArchive);
        });
    }.bind(null, location);

    // Begin magic
    getSites(callback, siteId);
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
            LOG("Unknown response, cannot continue");
        }
    });
}

function archiveSingleSite(site, location, callback) {
    makeRequest('post', site.ID + '/download', function(body, response) {
        LOG('Archive creation in progress for:', site.url);

        callback(site, location, body);
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
    _copyArchiveToRemote: copyArchiveToRemote,
    _waitForArchiveCreation: waitForArchiveCreation,
    _deleteSingleSiteArchive: deleteSingleSiteArchive,
    _checkForArchiveCreationComplete: getArchiveURL

});

var WPRemote = restler.service(function(apiKey) {
    if (!_.isUndefined(apiKey)) {
        this.defaults.username = apiKey;
        this.defaults.password = '';
        remote = this;
    } else {
        LOG("Missing API Key");
    }
}, {
    baseURL: apiURL
}, methods);

module.exports = WPRemote;
