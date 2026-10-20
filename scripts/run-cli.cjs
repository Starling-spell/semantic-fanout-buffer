const {spawn}=require('node:child_process'),path=require('node:path');
const args=process.argv.slice(2);
if(!['deploy','write'].includes(args[0]))throw Error('Only deploy/write supported');
const cli=process.env.FANOUT_CLI_PATH||path.resolve(__dirname,'../../intent-firewall/node_modules/genlayer/dist/index.js');
const child=spawn(process.execPath,['--dns-result-order=ipv4first','--require',path.join(__dirname,'pin-context.cjs'),
 '--require',path.join(__dirname,'broadcast-once.cjs'),cli,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.resume();let carry='',known=false;
const timer=setTimeout(()=>{child.kill();console.error('CLI timeout; inspect known hash before retry');},120000);
child.stderr.on('data',chunk=>{carry+=chunk.toString();const lines=carry.split(/\r?\n/);carry=lines.pop();
 if(carry.length>65536)carry='';for(const line of lines)if(/^BROADCAST_HASH 0x[0-9a-fA-F]{64}$/.test(line)){known=true;console.log(line);}
});
child.on('error',()=>{console.error('CLI launch failed');process.exitCode=1;});
child.on('close',code=>{clearTimeout(timer);console.log(JSON.stringify({cli_exit:code,hash_observed:known}));
 if(code!==0||!known){process.exitCode=1;console.error('Inspect history before any rebroadcast');}});
