// Process-local native signer selection; no key export or global configuration changes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const name=process.env.FANOUT_TEST_ACCOUNT;
if(!/^[A-Za-z0-9_-]{1,64}$/.test(name??''))throw Error('Set FANOUT_TEST_ACCOUNT');
const target=path.join(os.homedir(),'.genlayer','genlayer-config.json'),original=fs.readFileSync;
fs.readFileSync=function(file,options){const data=original.apply(this,arguments);
 if(typeof file!=='string'||path.resolve(file)!==target)return data;
 const updated=JSON.stringify({...JSON.parse(data.toString()),activeAccount:name,network:'studionet'});
 return typeof data==='string'?updated:Buffer.from(updated);
};
require('node:module').syncBuiltinESMExports();
