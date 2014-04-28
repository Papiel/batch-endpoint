'use strict';

var async = require('async');
var supertest = require('supertest');

module.exports = function endpointGenerator(server, options) {
  if(!options) {
    options = {};
  }

  options.maxPages = options.maxPages || 9;
  options.concurrency = options.concurrency || options.maxPages;
  options.forwardAuthorizationHeader = options.forwardAuthorizationHeader || false;


  return function(req, res, next) {
    var json = {};
    var statusCode = 200;

    if(!req.params.pages) {
      return next(new Error("Please specify at least one page to load."));
    }

    if(typeof req.params.pages !== 'object') {
      req.params.pages = [req.params.pages];
    }

    var isErrored = req.params.pages.some(function(page) {
      return typeof page !== 'string' || page.length === 0 || page[0] !== "/";
    });

    if(isErrored) {
      return next(new Error("Pages must be properly escaped URL starting with /"));
    }

    var pages = req.params.pages.slice(0, options.maxPages);

    async.eachLimit(
      pages,
      options.concurrency,
      function dispatchQueries(page, cb) {
        var query = supertest(server).get(page);

        if(options.forwardAuthorizationHeader) {
          query.set('authorization', req.headers.authorization);
        }

        query
          .expect(200)
          .end(function(err, res) {
            if (err) {
              json.errored = page;
              statusCode = (res && res.statusCode) ? res.statusCode : 500;
            }

            json[page] = (res && res.body) ? res.body : {};

            cb();
          });
      },
      function sendDatas() {
        res.send(statusCode, json);
        next();
      });
  };
};