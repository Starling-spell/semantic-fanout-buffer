import assert from 'node:assert/strict';
import {canonical,digest,sha,read} from './check.mjs';

export function decision(packet,config){
 const vector=packet.report.labels,snapshot=packet.credit_state;
 if(packet.report.source.status!=='OK')return {status:'HELD',matched:[],blocked:[]};
 if(vector.some(x=>x==='UNKNOWN'))return {status:'UNRESOLVED',matched:[],blocked:[]};
 const selected=new Set(vector.flatMap((x,i)=>x==='YES'?[config.members[i]]:[]));
 const matched=config.members.filter(x=>selected.has(x));
 if(!matched.length)return {status:'NO_MATCH',matched:[],blocked:[]};
 const blocked=matched.filter(a=>snapshot.outstanding[a]+1>config.credit);
 return {status:blocked.length||snapshot.slots.every(Boolean)?'BACKPRESSURED':'PUBLISHED',matched,blocked};
}

export function verifyDelivery(packet,delivery,members){
 assert.equal(delivery.channel,packet.channel);assert.equal(delivery.packet_root,packet.root);
 assert.equal(delivery.slot,packet.slot);assert.equal(delivery.generation,packet.generation);
 assert(['ACTIVE','DRAINED','EXPIRED'].includes(delivery.status));
 for(const k of ['pending','acked','expired'])assert(Array.isArray(delivery[k])&&new Set(delivery[k]).size===delivery[k].length);
 const partition=[...delivery.pending,...delivery.acked,...delivery.expired];
 assert.equal(new Set(partition).size,partition.length);
 assert.equal(canonical([...partition].sort()),canonical([...packet.matched].sort()));
 assert(partition.every(x=>members.includes(x)));
 if(delivery.status==='ACTIVE')assert(delivery.pending.length>0&&!delivery.expired.length);
 if(delivery.status==='DRAINED')assert(!delivery.pending.length&&!delivery.expired.length&&delivery.acked.length===packet.matched.length);
 if(delivery.status==='EXPIRED')assert(!delivery.pending.length&&delivery.expired.length>0);
 return true;
}

export async function state(address,channel){
 const room=await read(address,'get_channel',[channel]),c=room.config;
 assert.equal(c.contract,address);assert.equal(c.policy,'semantic-fanout-buffer-v1');
 assert.equal(channel,digest({contract:address,creator:c.creator,nonce:c.nonce}));
 assert(c.members.length>=2&&c.members.length<=4&&new Set(c.members).size===c.members.length);
 assert(Number.isInteger(c.capacity)&&c.capacity>=1&&c.capacity<=4);
 assert(c.credit===1||c.credit===2);assert(c.ttl>=60&&c.ttl<=3600);
 assert(['ENROLLING','ACTIVE','ABORTED'].includes(room.status));
 if(room.status==='ACTIVE')assert.equal(room.config_root,digest({config:c,filters:room.filters}));
 assert.equal(room.slots.length,c.capacity);assert.equal(room.generations.length,c.capacity);
 assert(room.attempts.length<=24&&new Set(room.attempts).size===room.attempts.length);
 const packets=[],pending=Object.fromEntries(c.members.map(a=>[a,0])),generations=Array(c.capacity).fill(0);
 for(const id of room.attempts){
  const p=await read(address,'get_packet',[id]),{root,...body}=p,b=p.report.binding,s=p.report.source;
  assert.equal(digest(body),root);assert.equal(p.channel,channel);
  assert.equal(b.channel,channel);assert.equal(b.config_root,room.config_root);assert.equal(b.packet,id);
  assert.equal(b.policy,c.policy);assert(c.members.includes(b.publisher));
  assert.equal(id,digest({contract:address,channel,publisher:b.publisher,nonce:p.nonce}));
  assert.equal(b.credit_state_root,digest(p.credit_state));
  assert.equal(p.credit_state.slots.length,c.capacity);assert.equal(p.credit_state.generations.length,c.capacity);
  assert.equal(s.url,b.source.url);
  assert(/^https:\/\/raw\.githubusercontent\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/[0-9a-f]{40}\/[A-Za-z0-9_./-]+\.txt$/.test(s.url));
  if(['OK','HASH_MISMATCH'].includes(s.status)){
   assert.equal(s.http,200);assert(Buffer.byteLength(s.body)>=1&&Buffer.byteLength(s.body)<=4096);
   assert.equal(sha(s.body),s.hash);assert.equal(s.status,s.hash===b.source.sha256?'OK':'HASH_MISMATCH');
  }else assert(['UNAVAILABLE','HTTP_ERROR','SIZE_ERROR','ENCODING_ERROR'].includes(s.status)&&!s.body&&!s.hash);
  if(s.status==='OK')assert(p.report.labels.length===c.members.length&&p.report.labels.every(x=>['YES','NO','UNKNOWN'].includes(x)));
  else assert.deepEqual(p.report.labels,[]);
  assert.equal(canonical({status:p.status,matched:p.matched,blocked:p.blocked}),canonical(decision(p,c)));
  if(p.status==='PUBLISHED'){
   assert.equal(p.slot,p.credit_state.slots.indexOf(''));assert.equal(p.generation,p.credit_state.generations[p.slot]+1);
   assert.equal(p.generation,generations[p.slot]+1);generations[p.slot]=p.generation;
   const delivery=await read(address,'get_delivery',[id]);verifyDelivery(p,delivery,c.members);
   assert.equal(delivery.deadline,p.created_at+c.ttl);
   if(delivery.status==='ACTIVE'){
    assert.equal(room.slots[p.slot],id);assert.equal(room.generations[p.slot],p.generation);
    for(const a of delivery.pending)pending[a]++;
   }else assert.notEqual(room.slots[p.slot],id);
   packets.push({id,packet:p,delivery});
  }else{assert(p.slot===-1&&p.generation===0);packets.push({id,packet:p});}
 }
 assert.equal(canonical(room.generations),canonical(generations));
 assert.equal(canonical(room.outstanding),canonical(pending));assert(Object.values(pending).every(n=>n>=0&&n<=c.credit));
 for(const id of room.slots.filter(Boolean))assert(packets.some(x=>x.id===id&&x.delivery?.status==='ACTIVE'));
 return {channel,room,packets,verified:true};
}
