import {createHash} from 'node:crypto';
import {lstatSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Character} from '../src/contracts';
import {validateCharacter} from '../src/renderer/character';
import {validateMotions,validateEmbeddedVRM} from '../src/renderer/motions';

export const characterBundleLimits={files:10_000,bytes:2*1024**3,fileBytes:64*1024**2};
export function characterAssetFiles(c:Character):string[] {
 return [...new Set([c.preview,c.background,...c.layers.flatMap(l=>[l.src,l.blink,l.speaking].filter((p):p is string=>!!p)),
  ...(c.portrait?[c.portrait.blink,c.portrait.speaking,c.portrait.thinking,c.portrait.listening,...(c.portrait.idle?.sheets??[]),...(c.portrait.speech?.sheets??[]),...(c.portrait.body?.sheets??[]),...(c.portrait.body?.frameFiles??[])]:[]),
  ...(c.portrait?.body?.clips?.flatMap(clip=>[clip.video,clip.videoLowPower].filter((p):p is string=>!!p))??[]),
  ...(c.model?[c.model.src,c.model.motions]:[])
 ])];
}
export function inspectCharacters(root:string) {
 root=resolve(root);
 if(lstatSync(root).isSymbolicLink()||!lstatSync(root).isDirectory())throw Error('角色根目录必须是实际目录');
 const catalog:Character[]=[],files=new Map<string,{bytes:number;sha256:string}>();let bytes=0;
 function read(file:string) {
  if(!/^(?:[a-z0-9-]{1,40}\/)?[a-zA-Z0-9_-]+\.(json|svg|png|webp|jpg|vrm|mov)$/.test(file))throw Error('角色素材路径无效');
  const path=join(root,file),stat=lstatSync(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>characterBundleLimits.fileBytes)throw Error('角色素材必须是有界限的普通文件');
  if(!files.has(file)){bytes+=stat.size;if(files.size+1>characterBundleLimits.files||bytes>characterBundleLimits.bytes)throw Error('角色包超出文件数量或总容量上限');}
  const data=readFileSync(path);files.set(file,{bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});return data;
 }
 for(const entry of readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.isSymbolicLink())throw Error('角色目录不允许符号链接');
  if(!entry.isDirectory())continue;
  if(!/^[a-z0-9-]{1,40}$/.test(entry.name)||catalog.length>=64)throw Error('角色目录名或数量无效');
  const c=validateCharacter(JSON.parse(read(`${entry.name}/manifest.json`).toString('utf8')));
  if(c.id!==entry.name)throw Error('角色 ID 必须与目录名一致');
  for(const file of characterAssetFiles(c)){
   const data=read(`${entry.name}/${file}`);
   function pngSize(width:number,height:number,label:string){if(data.length<24||data.toString('hex',0,8)!=='89504e470d0a1a0a'||data.readUInt32BE(16)!==width||data.readUInt32BE(20)!==height)throw Error(`${label}尺寸不匹配`);}
   if(c.portrait?.speech?.sheets.includes(file)){const a=c.portrait.speech;pngSize(a.columns*a.tileWidth,a.rows*a.tileHeight,'嘴型图集');}
   if(c.portrait?.idle?.sheets.includes(file)){const a=c.portrait.idle;pngSize(a.columns*a.tileSize,a.rows*a.tileSize,'动作图集');}
   if(c.portrait?.body?.sheets.includes(file)){const a=c.portrait.body;pngSize(a.columns*a.width,a.rows*a.height,'身体动作图集');}
   if(c.portrait?.body?.frameFiles?.includes(file)){const a=c.portrait.body;pngSize(a.frameWidth!,a.frameHeight!,'身体原始帧');}
   if(file.endsWith('.mov')&&(data.length<32||data.toString('ascii',4,8)!=='ftyp'))throw Error('透明视频容器无效');
   if(file.endsWith('.svg')&&(/<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=|<!ENTITY|@import|url\(\s*(?!#)/i.test(data.toString('utf8'))))throw Error('角色 SVG 只允许自包含的静态图形');
   if(file===c.model?.src)validateEmbeddedVRM(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
   if(file===c.model?.motions)validateMotions(JSON.parse(data.toString('utf8')));
  }
  catalog.push(c);
 }
 if(!catalog.length||new Set(catalog.map(c=>c.id)).size!==catalog.length)throw Error('角色清单为空或 ID 重复');
 const catalogText=JSON.stringify(catalog,null,2)+'\n';
 if(Buffer.byteLength(catalogText)>characterBundleLimits.fileBytes)throw Error('生成的角色清单容量超出单文件上限');
 if(files.size+1>characterBundleLimits.files||bytes+Buffer.byteLength(catalogText)>characterBundleLimits.bytes)throw Error('角色包超出文件数量或总容量上限');
 return {catalog,catalogText,files,bytes:bytes+Buffer.byteLength(catalogText)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../resources/characters/',import.meta.url));
 const result=inspectCharacters(root);writeFileSync(join(root,'catalog.json'),result.catalogText);
 console.log(`已校验 ${result.catalog.length} 个角色包`);
}
