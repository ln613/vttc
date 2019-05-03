'use strict';

const jwt = require('jsonwebtoken');
const { connectDB, get, getIdName, getById, search, getPlayerRating, getPlayerGames, cdList, cdVersion, initdata, backup, updateRating, genrr, gengroup, nogame, getNewGameId, addToList, add, replaceList, replace, update, count } = require('./api');
const { tap, res, policy } = require('./utils');

module.exports.api = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const { doc, id, fields, prop, val, idname, player_rating, rating_date, player_games, lookup } = event.queryStringParameters;
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
  } else if (doc) {
    r = await get(doc);
  }

  return res(r);
};

module.exports.admin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const q = event.queryStringParameters;
  const body = JSON.parse(event.body);
  const method = event.httpMethod;
  await connectDB();
  let r = 'no action';

  if (method === 'COPY') {
    if (q.initdb) {
      await initdata();
      r = await updateRating();
    } else if (q.bak) {
      r = await backup();
    }
  } else if (method === 'POST') {
    if (q.genrr) {
      r = await genrr(body);
    } else if (q.gengroup) {
      r = await gengroup(+body.id);
    } else if (q.nogame) {
      r = await nogame(body);
    } else if (q.doc && q.id && q.list) {
      r = await addToList(q.doc, q.id, q.list, body);
    } else if (q.doc) {
      r = await add(q.doc, body);
    }
  } else if (method === 'PUT') {
    if (q.groupmatch) {
      r = await groupmatch(q.id, q.group, body);
    } else if (q.doc && q.id && q.list) {
      r = await replaceList(q.doc, q.id, q.list, body);
    } else if (q.doc) {
      r = await replace(q.doc, body);
    }
  } else if (method === 'PATCH') {
    if (q.updaterating) {
      r = await updaterating();
    } else if (q.result) {
      await replaceList('tournaments', q.id, 'games', body);
      r = await updaterating();
    } else if (q.doc) {
      r = await update(q.doc, body);
    }
  } else if (method === 'PURGE') {
    if (q.doc) {
      r = await drop(q.doc);
    }
  } else if (method === 'GET') {
    if (q.cd) {
      r = await cdList();
    } else if (q.doc && q.count) {
      r = await count(q.doc);
    } else if (q.newgameid) {
      r = await getNewGameId();
    }
  }

  return res(r);
};

module.exports.authorize = async event => {
    await jwt.verify(event.authorizationToken, process.env.JWT_SECRET);
    return policy(event.methodArn.replace('random-account-id', '*').replace('random-api-id', '*'));
};

module.exports.login = async event => {
  const { username, password } = JSON.parse(event.body);

  if (username != process.env.ADMIN_USER || password != process.env.ADMIN_PASSWORD) {
    return res({ isAuthenticated: false }, 401);
  } else {
    const token = jwt.sign({}, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res({ isAuthenticated: true, token });
  };
};

module.exports.logout = async event => res({ isAuthenticated: false });


// https://raw.githubusercontent.com/ln613/n2/master/data/db.json