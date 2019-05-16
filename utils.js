const R = require('ramda');

const e = {};

e.tap = x => R.tap(console.log, R.isNil(x) ? 'null' : x);

e.res = (body, code) => ({
  statusCode: code || 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST'
  },
  body: JSON.stringify(body)
});

module.exports = e;
