
var common          = require('./common.rate');
    rate            = require('../lib/rate');

var onFinished = function () {
    
};

module.exports = {

    'baseline: server can be tested' : function () {
        common['baseline: server can be tested']();
    },

    'server records rate': function (done) {
        var handler = new rate.Memory.MemoryRateHandler();
        common['server records rate'](handler, onFinished);
    },

    'Reset after interval': function (done) {
        var handler = new rate.Memory.MemoryRateHandler();
        common['Reset after interval'](handler, onFinished);
    },

    'Routes can be rate limited, reallowed, and have proper headers': function (done) {
        var handler = new rate.Memory.MemoryRateHandler();
        common['Routes can be rate limited, reallowed, and have proper headers'](handler, onFinished);
    }
};