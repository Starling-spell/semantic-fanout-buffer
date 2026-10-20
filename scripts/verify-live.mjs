import fs from 'node:fs';
import assert from 'node:assert/strict';
import {rpc,receipt,source,read,denied,canonical} from './check.mjs';
import {state} from './state.mjs';
try{
 const p=JSON.parse(fs.readFileSync('PROOFS.json','utf8'));assert(p.final_readback_verified);
 assert.equal(await rpc('eth_chainId',[]),'0xf22f');assert.equal(canonical(await source(p.address)),canonical(p.source));
 for(const entry of p.transactions){
  assert(entry.verified&&entry.hash&&!entry.broadcast_unknown);
  const actual=await receipt(entry.hash,entry.expected,entry.expected_message);
  for(const key of ['hash','address','status','execution','consensus','committed'])assert.equal(actual[key],entry[key]);
  await new Promise(r=>setTimeout(r,2200));
 }
 for(const name of ['main','expiry']){
  const actual=await state(p.address,p.channels[name]);assert.equal(canonical(actual),canonical(p.final_states[name]));
 }
 for(const {id,packet} of Object.values(p.packets))assert.equal(canonical(await read(p.address,'get_packet',[id])),canonical(packet));
 for(const name of ['bad-source','credit-blocked'])assert(await denied(p.address,'get_delivery',[p.packets[name].id]));
 assert.equal(await read(p.address,'transition_count',[]),p.transitions.length);
 for(let i=0;i<p.transitions.length;i++)assert.equal(canonical(await read(p.address,'get_transition',[i])),canonical(p.transitions[i]));
 assert.deepEqual(await read(p.address,'mailbox',[p.channels.expiry,p.accounts[0].address]),[]);
 console.log(JSON.stringify({verified:true,address:p.address,transactions:p.transactions.length,packets:Object.keys(p.packets).length,source_match:true}));
}catch{console.error('Read-only verification failed; no transaction signed or sent');process.exitCode=1;}
