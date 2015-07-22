var AWS = require('aws-sdk');
var request = require('request');
var _ = require('lodash');
var path = require('path');

AWS.config.apiVersions = {
    s3: '2006-03-01'
};

var s3;

var setup = function(config) {
    var params = {};

    if (!_.isUndefined(config.aws_access_key) && !_.isUndefined(config.aws_secret_key)) {
        AWS.config.update({
            accessKeyId: config.aws_access_key,
            secretAccessKey: config.aws_secret_key
        });
    }

    if (!_.isUndefined(config.aws_bucket_name)) {
        params.Bucket = config.aws_bucket_name;
    }

    s3 = new AWS.S3({
        params: params
    });
};

var put_from_url = function(url, callback) {
    request({
        url: url,
        encoding: null
    }, function(err, res, body) {

        if (err)
            throw err;

        s3.upload({
            Key: path.basename(url),
            ContentType: res.headers['content-type'],
            ContentLength: res.headers['content-length'],
            Body: body // buffer
        }, callback);
    });
};

module.exports = {
    init: setup,
    upload: put_from_url
};
