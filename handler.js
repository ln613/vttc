const { startsWith, trim } = require('ramda');
const multipart = require('aws-lambda-multipart-parser');
const fs = require('fs');
const cd = require('cloudinary');
const cloudconvert = new (require('cloudconvert'))(process.env.CLOUDCONVERT_APIKEY);
const { tap, res } = require('./utils');

const tmp = '/tmp/1.docx';

cd.config({ cloud_name: 'vttc', api_key: process.env.CLOUDINARY_KEY, api_secret: process.env.CLOUDINARY_SECRET });

module.exports.convert = async (event, context, cb) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const contentType = event.headers['Content-Type'] || event.headers['content-type'];

  if (!startsWith('multipart/form-data', trim(contentType)))
    return res('no file');
  
  const result = multipart.parse(event, true);
  fs.writeFileSync(tmp, result.f1.content);
  const url = await convert();
  await cd.v2.uploader.upload('http:' + url, { folder: 'docs' });

  return res('done');
};

const convert = async () => new Promise(resolve =>
  cloudconvert.createProcess({ inputformat: 'docx', outputformat: 'png' },
    (e, c) => c.start({ input: 'upload', outputformat: 'png' },
      (e, s) => s.upload(fs.createReadStream(tmp), null,
        (e, u) => u.wait((e, w) => resolve(w.data.output.url)))))
);
