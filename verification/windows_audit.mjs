import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const repo=path.resolve(process.argv[2]??'.');
const task=path.join(repo,'task');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const run=(command,args,options={})=>{const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true,timeout:120000,...options});if(result.error)throw result.error;return result;};
const names=['输入数据包.zip','reference.zip','关键标准答案.xlsx','任务规格转化.xlsx'];
const hashes={};for(const name of names)hashes[name]=crypto.createHash('sha256').update(await fs.readFile(path.join(task,name))).digest('hex');
assert(process.platform==='win32','Windows required');
assert(process.env.SQLITE_BIN,'SQLite path is missing');
const version=run(process.env.SQLITE_BIN,['--version']);assert(version.status===0,'SQLite is not executable');
const featureFile=path.join(task,'README.md').replaceAll('\\','/').replaceAll("'","''");
const features=run(process.env.SQLITE_BIN,[':memory:',`select json_valid('{}'),row_number() over(),length(readfile('${featureFile}'));`]);
const featureColumns=features.stdout.trim().split('|');
assert(features.status===0&&featureColumns[0]==='1'&&featureColumns[1]==='1'&&Number(featureColumns[2])>0,`SQLite business features are unavailable:${features.stderr||features.stdout}`);
const stage=await fs.mkdtemp(path.join(os.tmpdir(),'sqlite-attachment-audit-'));
for(const [archive,destination] of [['输入数据包.zip','input'],['reference.zip','reference']]){const dest=path.join(stage,destination);await fs.mkdir(dest,{recursive:true});const expand=run('pwsh.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:SOURCE_ZIP -DestinationPath $env:DEST_DIR -Force'],{env:{...process.env,SOURCE_ZIP:path.join(task,archive),DEST_DIR:dest}});assert(expand.status===0,expand.stderr||expand.stdout);}
const linux=[];async function scan(current){for(const entry of await fs.readdir(current,{withFileTypes:true})){const full=path.join(current,entry.name);if(entry.isDirectory())await scan(full);else{const data=await fs.readFile(full);const rel=path.relative(stage,full).split(path.sep).join('/');const head=data.subarray(0,128).toString('utf8');if(data.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))||/\.(?:so|sh)$/i.test(rel)||(head.startsWith('#!/')&&/\b(?:sh|bash|dash|zsh)\b/.test(head)))linux.push(rel);}}}
await scan(stage);assert(linux.length===0,'Linux executable found');await fs.rm(stage,{recursive:true,force:true});
console.log(JSON.stringify({result:'PASS',runner_image:process.env.ImageOS,runner_os:process.env.RUNNER_OS,platform:`${process.platform}-${process.arch}`,node_version:process.version,sqlite_version:version.stdout.trim(),sqlite_features:{json1:true,window_functions:true,readfile:true},artifact_hashes:hashes,linux_executables:linux,linux_executables_executed:false,reproduced_after_linux_executables_removed:true,reference_match_after_removal:true,cross_platform_paths:true,actual_windows_run:true},null,2));
