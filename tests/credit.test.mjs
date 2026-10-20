import {test} from 'node:test';
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {decision,verifyDelivery} from '../scripts/state.mjs';
import {jsonSafe} from '../scripts/check.mjs';
test('multicast consumes one slot but one credit per matched recipient',()=>{
 const p={channel:'room',root:'r',slot:0,generation:1,matched:['a','b']};
 const d={channel:'room',packet_root:'r',slot:0,generation:1,status:'ACTIVE',pending:['b'],acked:['a'],expired:[]};
 assert(verifyDelivery(p,d,['a','b']));assert.throws(()=>verifyDelivery(p,{...d,acked:['a','b']},['a','b']));
});
test('expired and drained partitions cannot acknowledge or refund twice',()=>{
 const p={channel:'room',root:'r',slot:0,generation:1,matched:['a','b']};
 const d={channel:'room',packet_root:'r',slot:0,generation:1,status:'EXPIRED',pending:[],acked:['a'],expired:['b']};
 assert(verifyDelivery(p,d,['a','b']));assert.throws(()=>verifyDelivery(p,{...d,expired:['a','b']},['a','b']));
});
test('all two-subscriber match vectors and credits are independently reduced',()=>{
 let checked=0;const c={members:['a','b'],credit:1};
 for(const a of ['YES','NO','UNKNOWN'])for(const b of ['YES','NO','UNKNOWN'])for(const x of [0,1])for(const y of [0,1])for(const full of [false,true]){
  const p={report:{source:{status:'OK'},labels:[a,b]},credit_state:{outstanding:{a:x,b:y},slots:full?['p','q']:['','']}};
  const result=decision(p,c);
  const expected=[a,b].includes('UNKNOWN')?'UNRESOLVED':a==='NO'&&b==='NO'?'NO_MATCH':
   full||a==='YES'&&x||b==='YES'&&y?'BACKPRESSURED':'PUBLISHED';
  assert.equal(result.status,expected);checked++;
 }assert.equal(checked,72);
});
test('SDK map normalization preserves nested public packets',()=>{
 const p={labels:['YES','NO'],credit_state:{slots:[''],outstanding:{a:1,b:0}}};
 assert.deepEqual(jsonSafe(abi.calldata.decode(abi.calldata.encode(p))),p);
});
