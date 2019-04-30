'use strict';

require('dotenv').config({ path: './.env' });

const MongoClient = require('mongodb').MongoClient;
const { tap } = require('./utils');

let db = null;

const connectDB = async () => db || (db = await MongoClient.connect(process.env.DB).then(x => x.db()));

module.exports.vttc = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connectDB();

  const doc = event.queryStringParameters['doc'];
  const results = await db.collection(doc).find().project({ _id: 0 }).toArray();
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(results)
  };
};
