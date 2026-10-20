import fs from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {getAddress} from 'viem';
import {rpc,receipt,source,read,denied,digest,sha,canonical} from './check.mjs';
import {state} from './state.mjs';
const accounts=[
 {name:'studio-proof-deployer',address:'0x7a413bb4ab62e31d62d4cd9efc8c8a8dae37fb42'},
 {name:'fairresolve-demo',address:'0x34346773a22564cbcc5f1d67d1c1f9f196daea35'},
 {name:'reality-random2',address:'0x5585ea8f2fcc126bad0830eb9701e19b3cd800d5'}
].map(x=>({...x,address:getAddress(x.address)}));
const [A,B,C]=accounts,file='PROOFS.json',commit=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(commit??''))throw Error('Supply published full fixture commit');
let p=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):
 {network:'studionet',chain_id:61999,fixture_commit:commit,accounts,transactions:[],channels:{},packets:{},checkpoints:{}};
assert.equal(p.fixture_commit,commit);
const save=()=>fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
p.final_readback_verified=false;save();
function broadcast(args,signer,onHash){return new Promise((resolve,reject)=>{
 const proc=spawn(process.execPath,['--dns-result-order=ipv4first','scripts/run-cli.cjs',...args],{windowsHide:true,
  env:{...process.env,FANOUT_TEST_ACCOUNT:signer.name},stdio:['ignore','pipe','pipe']});
 let carry='';proc.stderr.resume();proc.stdout.on('data',chunk=>{carry+=chunk.toString();const lines=carry.split(/\r?\n/);carry=lines.pop();
  for(const line of lines)if(/^BROADCAST_HASH 0x[0-9a-fA-F]{64}$/.test(line))onHash(line.split(' ')[1]);});
 proc.on('error',()=>reject(Error('CLI launch failed')));proc.on('close',resolve);
});}
async function tx(step,args,signer=A,expected='SUCCESS',message){
 let entry=p.transactions.find(t=>t.step===step);
 if(!entry){entry={step,signer:signer.address,expected,verified:false,broadcast_unknown:true,cli_arguments:args,
  ...(message?{expected_message:message}:{})};p.transactions.push(entry);save();
  await broadcast(args,signer,hash=>{entry.hash=hash;delete entry.broadcast_unknown;save();console.log(step+' '+hash);});}
 if(!entry.hash)throw Error('Unknown broadcast outcome; inspect signer history before rebroadcast');
 assert.equal(canonical(entry.cli_arguments),canonical(args));assert.equal(entry.signer,signer.address);
 Object.assign(entry,await receipt(entry.hash,expected,message),{verified:true});save();
 console.log(JSON.stringify({step,status:entry.status,execution:entry.execution,consensus:entry.consensus}));
 if(expected==='SUCCESS'&&!entry.committed)throw Error('Consensus disagreement: no state committed');return entry;
}
const write=(step,method,args,signer=A,expected='SUCCESS',message)=>tx(step,['write',p.address,method,'--args',...args.map(String)],signer,expected,message);
async function checkpoint(name,fn){if(!p.checkpoints[name]){p.checkpoints[name]=await fn();save();}return p.checkpoints[name];}
async function publish(name,channel,fixture,status,expectedLabels){
 const path='examples/'+fixture+'.txt',coordinate='Starling-spell/semantic-fanout-buffer/'+commit+'/'+path;
 const hash=fixture==='bad'? 'f'.repeat(64):sha(fs.readFileSync(path));
 const actualCoordinate=fixture==='bad'?coordinate.replace('/bad.txt','/shared.txt'):coordinate;
 await write(name,'publish',[channel,name,actualCoordinate,hash]);
 const id=digest({contract:p.address,channel,publisher:A.address,nonce:name}),packet=await read(p.address,'get_packet',[id]);
 assert.equal(packet.status,status);assert.deepEqual(packet.report.labels,expectedLabels);
 p.packets[name]={id,packet};save();return p.packets[name];
}
async function ack(step,channel,packet,signer){
 return write(step,'ack',[channel,packet.id,packet.packet.generation,packet.packet.root],signer);
}
try{
 assert.equal(await rpc('eth_chainId',[]),'0xf22f');
 for(const fixture of ['shared','maintenance','neither']){
  const path='examples/'+fixture+'.txt',url='https://raw.githubusercontent.com/Starling-spell/semantic-fanout-buffer/'+commit+'/'+path;
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});assert(response.ok);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path)));
 }
 const deployed=await tx('deploy',['deploy','--contract','contracts/SemanticFanoutBuffer.py']);
 p.address=deployed.address;p.source=await source(p.address);save();
 const predicates=[
  'The authored notice includes a definite planned-maintenance service-unavailability statement, even if fictional.',
  'The authored notice includes a definite increase of a subscription price, even if fictional.'
 ];
 for(const [name,ttl] of [['main',1800],['expiry',60]]){
  await write('open-'+name,'open_channel',[name+'-v1',A.address+','+B.address,2,1,ttl]);
  const id=digest({contract:p.address,creator:A.address,nonce:name+'-v1'});p.channels[name]=id;save();
  await write('subscribe-'+name+'-A','subscribe',[id,predicates[0]],A);
  await write('subscribe-'+name+'-B','subscribe',[id,predicates[1]],B);
  await write('activate-'+name,'activate',[id],C);
  assert.equal((await read(p.address,'get_channel',[id])).status,'ACTIVE');
 }
 const main=p.channels.main,expiry=p.channels.expiry;
 const shared=await publish('shared-first',main,'shared','PUBLISHED',['YES','YES']);
 await ack('ack-shared-A',main,shared,A);
 await checkpoint('partial-ack',async()=>{
  const s=await state(p.address,main),d=await read(p.address,'get_delivery',[shared.id]);
  assert.deepEqual(d.pending,[B.address]);assert.equal(s.room.outstanding[A.address],0);assert.equal(s.room.outstanding[B.address],1);
  assert.equal(s.room.slots.filter(Boolean).length,1);return {room:s.room,delivery:d};
 });
 const blocked=await publish('credit-blocked',main,'shared','BACKPRESSURED',['YES','YES']);
 assert.deepEqual(blocked.packet.blocked,[B.address]);assert(blocked.packet.credit_state.slots.includes(''));
 const ready=await publish('ready-only',main,'maintenance','PUBLISHED',['YES','NO']);
 assert.deepEqual(ready.packet.matched,[A.address]);assert.equal(ready.packet.slot,1);
 await ack('ack-ready-A',main,ready,A);await ack('ack-shared-B',main,shared,B);
 await checkpoint('drained',async()=>{
  const s=await state(p.address,main);assert(s.room.slots.every(x=>!x));assert(Object.values(s.room.outstanding).every(x=>x===0));return s;
 });
 const reused=await publish('slot-reuse',main,'shared','PUBLISHED',['YES','YES']);
 assert.equal(reused.packet.slot,shared.packet.slot);assert.equal(reused.packet.generation,shared.packet.generation+1);
 await write('outsider-ack','ack',[main,reused.id,reused.packet.generation,reused.packet.root],C,'ERROR','Not a pending subscriber');
 await write('cross-channel-ack','ack',[expiry,reused.id,reused.packet.generation,reused.packet.root],A,'ERROR','Delivery channel mismatch');
 await write('wrong-root-ack','ack',[main,reused.id,reused.packet.generation,'f'.repeat(64)],A,'ERROR','Packet root mismatch');
 await write('stale-slot-ack','ack',[main,shared.id,shared.packet.generation,shared.packet.root],A,'ERROR','Slot fence mismatch');
 const reusedArgs=p.transactions.find(t=>t.step==='slot-reuse').cli_arguments.slice(4);
 await write('publisher-replay','publish',reusedArgs,A,'ERROR','Packet nonce used');
 const held=await publish('bad-source',main,'bad','HELD',[]);
 assert(await denied(p.address,'get_delivery',[held.id]));assert(await denied(p.address,'get_delivery',[blocked.id]));
 const expiring=await publish('expire-me',expiry,'maintenance','PUBLISHED',['YES','NO']);
 await checkpoint('expiry-published',async()=>({delivery:await read(p.address,'get_delivery',[expiring.id])}));
 let mailbox=await read(p.address,'mailbox',[expiry,A.address]);
 for(let i=0;mailbox.length&&i<24;i++){await new Promise(r=>setTimeout(r,5000));mailbox=await read(p.address,'mailbox',[expiry,A.address]);}
 assert.deepEqual(mailbox,[]);
 await write('public-expiry-sweep','sweep',[expiry],C);await write('idempotent-expiry-sweep','sweep',[expiry],C);
 const mainState=await state(p.address,main),expiryState=await state(p.address,expiry);
 assert.equal(mainState.room.attempts.length,5);assert.equal(expiryState.room.attempts.length,1);
 assert.equal(expiryState.packets[0].delivery.status,'EXPIRED');assert(Object.values(expiryState.room.outstanding).every(x=>x===0));
 assert.equal((await read(p.address,'get_delivery',[shared.id])).status,'DRAINED');
 assert.equal((await read(p.address,'get_delivery',[ready.id])).status,'DRAINED');
 for(const {id,packet} of Object.values(p.packets))assert.equal(canonical(await read(p.address,'get_packet',[id])),canonical(packet));
 const count=await read(p.address,'transition_count',[]);assert.equal(count,4);
 const transitions=[];for(let i=0;i<count;i++)transitions.push(await read(p.address,'get_transition',[i]));
 assert.deepEqual(transitions.map(x=>x.kind),['ACK','ACK','ACK','EXPIRE']);
 p.final_states={main:mainState,expiry:expiryState};p.transitions=transitions;p.source=await source(p.address);
 assert(p.transactions.every(t=>t.verified&&!t.broadcast_unknown));p.final_readback_verified=true;save();
 console.log(JSON.stringify({complete:true,address:p.address,packets:Object.keys(p.packets).length,transactions:p.transactions.length}));
}catch(e){console.error('Sanitized fanout workflow stopped: '+(e instanceof assert.AssertionError?'state assertion failed':'check recorded hashes/state before retry'));process.exitCode=1;}
