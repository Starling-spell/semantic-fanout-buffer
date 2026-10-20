import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
const h='a'.repeat(64),address='0x'+'1'.repeat(40),{calldata}=abi;
const calls=[['open_channel',['demo',address+','+'0x'+'2'.repeat(40),2,1,1800]],['subscribe',[h,'A complete authored subscription predicate.']],
 ['activate',[h]],['abort_unenrolled',[h]],['sweep',[h]],['publish',[h,'event','owner/repo/'+'b'.repeat(40)+'/examples/shared.txt','c'.repeat(64)]],
 ['ack',[h,'b'.repeat(64),1,'c'.repeat(64)]],['get_channel',[h]],['get_packet',[h]],['get_delivery',[h]],['mailbox',[h,address]],
 ['get_transition',[0]],['transition_count',[]]];
for(const [method,args] of calls){const bytes=calldata.encode(calldata.makeCalldataObject(method,args,{}));assert.deepEqual(calldata.encode(calldata.decode(bytes)),bytes);}
console.log('13 SDK calldata roundtrips passed');
