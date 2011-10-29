
var sys             = require('sys'),
    base            = require('./base');

//
// DEFINE THE MEMORY RATE HANDLER
//

var MemoryRateHandler = exports.MemoryRateHandler = function (options) {
    this.options = options;
    // stores the key value pairs corresponding with the rates of people using the site
    // TODO: flush out very old remote logs that have expired, REDIS will do that for you
    this.rates = {};
};

// inherit from the base rate handler
sys.inherits(MemoryRateHandler, base.BaseRateHandler);

MemoryRateHandler.prototype._increment_key = function (key, increment, rate_options, next, callback) {
    var remakeKey = true,
        currentTime = (new Date()).getTime(),
        ttl = currentTime,
        rate = 1;

    if (this.rates[key]) {
        
        var rateInfo = this.rates[key];

        if (currentTime < rateInfo.ttl) {
            // no need to remake the key
            remakeKey = false;
            // increment the counter
            rateInfo.value += increment;
            
            rate = rateInfo.value + increment;
            ttl = rateInfo.ttl;
        }
    }
    
    if (remakeKey) {

        ttl = currentTime + (rate_options.interval * 1000);
        this.rates[key] = {value: 1, ttl: ttl};

    }

    if (callback) callback(rate, ttl);
};

MemoryRateHandler.prototype._reset_key = function (key, increment, next, callback) {
    if (this.rates[key])
        delete this.rates[key];

    if (callback) callback();
};

MemoryRateHandler.prototype.getRate = function (routeKey, remoteKey, next, callback) {
    
    var fullKey = routeKey;
    if (remoteKey) {
        fullKey += ':' + remoteKey;
    }

    if (this.rates[fullKey]) {
        callback(this.rates[fullKey].value);
    } else {
        callback(0);
    }
        
};
