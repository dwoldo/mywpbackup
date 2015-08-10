var LOG = (process.env.NODE_ENV != 'test') ? console.log.bind(console) : function() {};
module.exports = LOG;
