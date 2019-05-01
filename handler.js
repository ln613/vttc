'use strict';

const jwt = require('jsonwebtoken');
const { connectDB, get, getIdName, getById, search, getPlayerRating, getPlayerGames, cdVersion } = require('./api');
const { tap, res, policy } = require('./utils');

module.exports.api = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const { doc, id, fields, prop, val, idname, player_rating, rating_date, player_games, lookup } = tap(event).queryStringParameters;
  await connectDB();
  let r = {};

  if (lookup) {
    const version = await cdVersion();
    const cats = await get('cats');
    r = { cats, cdVersion: version };
  } else if (idname) {
    r = await getIdName(doc);
  } else if (id && doc) {
    r = await getById(doc, id);
  } else if (fields || prop) {
    r = await search(doc, prop, val, fields);
  } else if (player_rating) {
    r = await getPlayerRating(id, rating_date);
  } else if (player_games) {
    r = await getPlayerGames(id);
  } else {
    r = await get(doc);
  }

  return res(r);
};

module.exports.admin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;


  await connectDB();
  let r = { a: 'b' };

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(r)
  };
};

module.exports.authorize = async (event, context) => {
  try {
    await jwt.verify(event.authorizationToken, process.env.JWT_SECRET);
    //context.succeed(policy(event.methodArn));
    return policy(event.methodArn);
  } catch (e) {tap(e);
    return res('Unauthorized', 401);
  }
};

module.exports.login = async event => {
  const { username, password } = JSON.parse(event.body);

  if (username != process.env.ADMIN_USER || password != process.env.ADMIN_PASSWORD) {
    return res('Login failed', 401, 'vttc_token=;');
  } else {
    const token = jwt.sign({}, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res('Login successful', 200, 'vttc_token=' + token + ';');
  };
};

