
# express-rate

express-rate is a express.js route specific middleware that monitors the rate at which specific routes get requested and allows you to limit a specific requester. This can be a basic prevention of DOS attacks, or simply used as a Twitter-like rate-limiter on your API. Comes with support for an in memory store, and a Redis store backed by [node_redis](http://github.com/mranney/node_redis).

This is an alpha release. 

## Installation

	  $ npm install express-rate

Note: this module requires redis > 2.1.3 because of changes in the behavior of the [expire](http://redis.io/topics/expire) action.


##### Options:

- *handler*

```js
new rate.Redis.RedisRateHandler({client: redis.createClient()})
```

  The rate handler that stores the routes for the rate. The built in handlers are for Redis (recommended) 
  and Memory (for testing or single webserver clusters - use new rate.Memory.MemoryRateHandler() ).

- *interval*

```js
1
```

  The interval of time in *seconds* that the middleware tracks your route. For interval=1, it will track 
  the amount of requests hitting your route per 1 second. For value=10, it will track requests per 10 seconds.

- *limit*

```js
0
```

  For any non-zero values of limit, rate-limiting will be turned on. For limit=10 and interval=1, the system
  will only allow 10 requests per second for a specific requester on this specific route. 
  For limit=100 and interval=10, the system will allow 100 requests per 10 seconds for this specific requester on this specific route.


- *getRemoteKey*

```js
function (req) {
  return req.connection.remoteAddress;
}
```

  A function that allows you to switch how rate identifies a specific requester. By default, it is their IP. You can override it with a function that sets it based on the authenticated user, or on a API key that the user is posting. See below in usage for an example. 

- *getRouteKey*

```js
function (req) {
  return req.route.method + ':' + req.route.regexp;
}
```

  A function that allows you to switch how rate identifies a route. By fefault, its the method:route_regex

- *setHeaders*

```js
true
```

  Whether you want to set rate limiting headers or not.

- *setHeadersHandler*

```js
function (req, res, rate, limit, resetTime) {

    var remaining = limit - rate;
    if (remaining < 0) {
        remaining = 0;
    }

    // follows Twitter's rate limiting scheme and header notation
    // https://dev.twitter.com/docs/rate-limiting/faq#info
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);
}
```

  A function that is called to cutomize the request and its headers to give the requester an idea of how rate-limited it is.

- *onLimitReached*

```js
function (req, res, rate, limit, resetTime, next) {
            
    // HTTP code 420 from http://mehack.com/inventing-a-http-response-code-aka-seriously
    res.json({error: 'Rate limit exceeded. Check headers for limit information.'}, {status: 420});
}
```

  A function that is called when a route's rate limit is reached. This will allow you to customize what you
  return back to the requester when they can no longer have access to this route.



## Usage

Below is code demonstrating use and customization of most of the use cases of rate:

```js

var rate            = require('../lib/rate'),
  redis     = require('redis'),
  client      = redis.createClient();

var app = require('express').createServer();

// create the rate redis handler
var redisHandler = new rate.Redis.RedisRateHandler({client: client});



// 
// Monitor rate of a route
//

// options: handler is the mechanism where rate information is kept
// interval is the interval on which we are listening for the rate. Here we're counting requests per 1 second.
// If we switch interval to 10, then we are counting how many requests this route is handling per 10 seconds.
var simpleMiddleware = rate.middleware({handler: redisHandler, interval: 1});

// apply the rate middleware to the / route
app.get('/', simpleMiddleware, function(req, res, next){
  res.send('I am being rate monitored at requests per 1 second.')
});

//
// Monitor the rate of this route, and report the RPS of **everyone** hitting this route
//
var monitorMiddleware1 = rate.middleware({handler: redisHandler, interval: 1});

// apply the rate middleware to the / route
app.get('/route-rate', monitorMiddleware1, function(req, res, next){
  var rateKey = req.route.method + ':' + req.route.regexp;
  redisHandler.getRate(rateKey, null, next, function (rate) {
    res.send('This route is being requested at ' + rate + ' requests per 1 second.');
  });
});

//
// Monitor the rate of this route, and report the RPS of **only you** hitting this route
//
var monitorMiddleware2 = rate.middleware({handler: redisHandler, interval: 1});

// apply the rate middleware to the / route
app.get('/me-rate', monitorMiddleware2, function(req, res, next){
  var rateKey = req.route.method + ':' + req.route.regexp;
  var remoteKey = req.connection.remoteAddress;
  redisHandler.getRate(rateKey, remoteKey, next, function (rate) {
    res.send(remoteKey + ' is requesting this route at ' + rate + ' requests per 1 second.');
  });
});

//
// Monitor and rate-limit this route
//

// this middleware will only allow 2 requests for every 4 seconds from a specific user
var limiterMiddleware = rate.middleware({handler: redisHandler, interval: 4, limit: 2});

app.get('/limited', limiterMiddleware, function(req, res){
  res.send('You can only request me twice every 4 seconds!');
});


// 
// Key requesters by their API key instead of IP
//

var apiKeyMiddleware = rate.middleware(
  {handler: redisHandler, 
   limit: 10,
   interval: 2, 
   getRemoteKey: function (req) {
    return req.params.api_key;
   }
});

app.get('/api/:api_key/operation', apiKeyMiddleware, function(req, res){
  res.send('API key ' + req.params.api_key + ' only has ' + res.getHeader('x-ratelimit-remaining') + ' remaining requests.');
});

// 
// Customize the headers sent back during rate limiting and the message returned
//

var headersMiddleware = rate.middleware(
  {handler: redisHandler, 
   limit: 5,
   interval: 5, 
   setHeadersHandler: function (req, res, rate, limit, resetTime) {

            var remaining = limit - rate;

            if (remaining < 0) {
                remaining = 0;
            }

            // follows Twitter's rate limiting scheme and header notation
            // https://dev.twitter.com/docs/rate-limiting/faq#info
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', resetTime);
        },

        onLimitReached: function (req, res, rate, limit, resetTime, next) {
            
            // HTTP code 420 from http://mehack.com/inventing-a-http-response-code-aka-seriously
            res.json({error: 'Rate limit exceeded. Check headers for limit information.'}, {status: 420});
        }
});

app.get('/headers', headersMiddleware, function(req, res){
  var text = 'X-RateLimit-Limit :' + res.getHeader('X-RateLimit-Limit') + '              ' + 
    'X-RateLimit-Remaining :' + res.getHeader('X-RateLimit-Remaining') + '              ' + 
    'X-RateLimit-Reset :' + res.getHeader('X-RateLimit-Reset');
  res.send(text);
});

app.listen(3000);

```

## TO-DOs

  - Support multiple intervals
  - Fix redis tests to work all together

## Testing

Get the testing requirements:

    $ npm install expresso -g
    $ npm install should

Go to the root project directory and run:

    $ make test

Note: redis tests (/test/redis.tests.js) work seperately but not together.