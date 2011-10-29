
// 
// DEFINE THE BASE RATE HANDLER
//

var BaseRateHandler = exports.BaseRateHandler = function (options) {
    this.options = options;
};

BaseRateHandler.prototype.increment = function (routeKey, remoteKey, rate_options, next, callback) {
    this._increment_key(routeKey, 1, rate_options, next, null);
    var remoteFullKey = routeKey + ':' + remoteKey;
    this._increment_key(remoteFullKey, 1, rate_options, next, callback);
};

BaseRateHandler.prototype.reset = function (routeKey, remoteKey, next, callback) {
    this._reset_key(routeKey, 1, next, null);
    var remoteFullKey = routeKey + ':' + remoteKey;
    this._reset_key(remoteFullKey, 1, next, callback);
};
