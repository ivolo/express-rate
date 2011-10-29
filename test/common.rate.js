

var express         = require('express'),
    assert          = require('assert'),
    should          = require('should'),

    rate            = require('../lib/rate'),
    memory          = require('../lib/memory');

module.exports = {

    routeKey: 'get:/^\\/\\/?$/i',
	
	'baseline: server can be tested' : function () {
		
		var server = express.createServer();

        var responseBody = 'works';

        server.get('/', function (req, res) {
            res.send(responseBody);
        });

        assert.response(server,
            { url: '/' },
            { body: responseBody });
	},

	'server records rate' : function (handler, done) {

        var self = this;

        handler.reset(module.exports.routeKey, null, null, function () {

    		var middleware = rate.middleware({handler: handler, interval: 2});
    		self.performRandomRequests(middleware, Math.random() * 100, function (responseNumber, requestsToPerform) {

    			
    			if (responseNumber === requestsToPerform) {

                    handler.getRate(module.exports.routeKey, null, null, function (rate) {
                    	
                        assert.eql(rate, requestsToPerform, 'Rate of received from middleware does not match sent.');
                        
                        done();
                    });
                }

    		});

        });
	},


	'Reset after interval': function (handler, done) {

        var self = this;

        handler.reset(module.exports.routeKey, null, null, function () {

    		var secondsIncrement = 1;
    		var resetTime = (new Date()).getTime() + (secondsIncrement * 1000);
    		var middleware = rate.middleware({handler: handler, interval: secondsIncrement});
    		var completed = false;
    		var inflections = 0;
    		var lastRateCount = null;

    		self.performRandomRequests(middleware, Math.random() * 15000, function (responseNumber, requestsToPerform) {

    			handler.getRate(module.exports.routeKey, null, null, function (rate) {
                    
                    if (lastRateCount && rate < lastRateCount)
                    	inflections += 1;
                    
                    lastRateCount = rate;
                       
                    if (responseNumber === requestsToPerform) {
                    	assert.eql((inflections > 0), true, 'There was no inflections, meaning the rate was never reversed, but was monotonically increasing.');
                        
                        done();
                    }
                });

    		});
        });
	},

	'Routes can be rate limited, reallowed, and have proper headers': function (handler, done) {
		
        var self = this;

        handler.reset(module.exports.routeKey, null, null, function () {

    		var server = express.createServer();

            var responseBody = 'works';
            var errorJson = 'limited';

            var limit = 10;
            var middleware = rate.middleware({handler: handler, interval: 5, limit: limit,
            	onLimitReached: function (req, res, rate, limit, resetTime, next) {
            
    		        // HTTP code 420 from http://mehack.com/inventing-a-http-response-code-aka-seriously
    		        res.send(errorJson, {status: 420});
    		    }
            });

            server.get('/', middleware,
                function (req, res) {
                    res.send(responseBody);
                }
            );

            var responsesReceived = 0;
            var stop = false;
            var limitedRequests = 0;
            var lastCheck = false;


            var makeRequest = function (response) {
                
                	assert.response(server,
                        { url: '/' },
                        response, 
                        function (res) {
                            responsesReceived += 1;

                            assert.isDefined(res.headers['X-RateLimit-Limit'.toLowerCase()]);
                            assert.isDefined(res.headers['X-RateLimit-Remaining'.toLowerCase()]);
                            assert.isDefined(res.headers['X-RateLimit-Reset'.toLowerCase()]);

                            // check the headers
                            assert.eql(res.headers['X-RateLimit-Limit'.toLowerCase()], limit, 'Limit does not match the header limit returned from server.');

                            if(res.body === errorJson) {
                            	limitedRequests += 1;
                            }
                            		
                            if (parseInt(res.headers['X-RateLimit-Remaining'.toLowerCase()]) > 0) {



                            	if (!lastCheck) {
                            		makeRequest({body: responseBody});
        	                    } else {

                                    done();
                                }
                            	
                             } else {

                             	if (limitedRequests > 5) {
                             		
                        			var currentTime = (new Date()).getTime();
                        			var sleepForMs = parseInt(res.headers['X-RateLimit-Reset'.toLowerCase()]) - currentTime;
                                    // TODO: bug, have to add an extra second for differences between redis time and local time
                                    // need to find correct way to do this
                        			sleepForMs += 1000;

                        			setTimeout(function () {

                        				lastCheck = true;
                        				makeRequest({body: responseBody});

                        			}, sleepForMs);

                             	} else {

                            		makeRequest({body: errorJson});
                            	}
                            }
                        }
                    );
                
            }

            makeRequest({body: responseBody});
        });
	},

	performRandomRequests: function (middleware, n, callback) {

		var server = express.createServer();

        var responseBody = 'works';

        
        server.get('/', middleware,
            function (req, res) {
                res.send(responseBody);
            }
        );

        var requestsToPerform = Math.ceil(n),
            responsesReceived = 0;

        for(var i = 0; i < requestsToPerform; i += 1) {
            
            assert.response(server,
                { url: '/' },
                { body: responseBody }, 
                function (res) {
                    responsesReceived += 1;
                    callback(responsesReceived, requestsToPerform);
                }
            );
        }
	}

}