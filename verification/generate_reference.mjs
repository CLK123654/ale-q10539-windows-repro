import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const repo=path.resolve(process.argv[2]??'.');const task=path.join(repo,'task');const stage=path.join(repo,'.windows-reference');const input=path.join(stage,'input');const solved=path.join(stage,'solved');
if(!process.env.SQLITE_BIN)throw new Error('SQLITE_BIN is required');
await fs.rm(stage,{recursive:true,force:true});await fs.mkdir(input,{recursive:true});await fs.mkdir(solved,{recursive:true});
function expand(archive,dest){const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:SOURCE_ZIP -DestinationPath $env:DEST_DIR -Force'],{encoding:'utf8',windowsHide:true,env:{...process.env,SOURCE_ZIP:archive,DEST_DIR:dest}});if(result.error)throw result.error;if(result.status!==0)throw new Error(result.stderr||result.stdout);}
expand(path.join(task,'输入数据包.zip'),input);expand(path.join(task,'reference.zip'),solved);
const inputRoot=path.join(input,'input_data');await fs.copyFile(path.join(solved,'output','sql','rebuild_sla.sql'),path.join(inputRoot,'starter','rebuild_sla.sql'));
const result=spawnSync(process.execPath,['tools/run-task.mjs'],{cwd:inputRoot,encoding:'utf8',windowsHide:true,timeout:180000,env:{...process.env,SQLITE_BIN:process.env.SQLITE_BIN}});if(result.error)throw result.error;if(result.status!==0)throw new Error(result.stderr||result.stdout);await fs.rename(path.join(input,'output'),path.join(stage,'output'));
