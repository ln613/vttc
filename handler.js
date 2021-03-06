const { startsWith, trim } = require('ramda');
const fs = require('fs');
const cd = require('cloudinary');
const { tap, res, cdVersion } = require('./utils');
//const multipart = require('aws-lambda-multipart-parser');
//const cloudconvert = new (require('cloudconvert'))(process.env.CLOUDCONVERT_APIKEY);

//const tmp = '/tmp/1.docx';

cd.config({ cloud_name: 'vttc', api_key: process.env.CLOUDINARY_KEY, api_secret: process.env.CLOUDINARY_SECRET });

module.exports.cdupload = async (event, context, cb) => {
  context.callbackWaitsForEmptyEventLoop = false;

  return res(await cd.v2.uploader.upload(JSON.parse(event.body).url, { public_id: 'slider/1', use_filename: true, unique_filename: false, overwrite: true }));
};

// const convert = async () => new Promise(resolve =>
//   cloudconvert.createProcess({ inputformat: 'docx', outputformat: 'png' },
//     (e, c) => c.start({ input: 'upload', outputformat: 'png' },
//       (e, s) => s.upload(fs.createReadStream(tmp), null,
//         (e, u) => u.wait((e, w) => resolve(w.data)))))
// );

// const convert1 = async (ver, fn) => new Promise(resolve =>
//   cloudconvert.createProcess({ inputformat: 'docx', outputformat: 'png' },
//     (e, c) => c.start({ input: 'download', outputformat: 'png', file: `https://res.cloudinary.com/vttc/raw/upload/${ver}/docs/${fn}` },
//       (e, u) => u.wait((e, w) => resolve(w.data.output.url))))
// );

// const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// const uploadAndConvert = async () => {
//   try {
//     const contentType = event.headers['Content-Type'] || event.headers['content-type'];

//     if (!startsWith('multipart/form-data', trim(contentType)))
//       return res('no file');
    
//     const result = multipart.parse(event, true);
    
//     fs.writeFileSync(tmp, result.f1.content);

//     //await cd.v2.uploader.upload(tap(result.f1.content), { folder: 'docs' });

//     // const ver = await cdVersion();

//     // const url = await convert1(ver, result.f1.filename);

//     const data = await convert();

//     // await sleep(3000);

//     await cd.v2.uploader.upload('https:' + data.output.url, { folder: 'docs' });

//     return data;
//   } catch (e) {
//     return e;
//   }
// }