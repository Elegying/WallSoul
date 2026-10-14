import {constants,copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectCharacters} from './check-characters';

// Only the validated manifest dependency closure enters the signed app bundle.
export function stageCharacters(source:string,destination:string) {
 source=realpathSync(source);destination=resolve(destination);
 mkdirSync(dirname(destination),{recursive:true});
 destination=join(realpathSync(dirname(destination)),basename(destination));
 const overlaps=(a:string,b:string)=>{const p=relative(a,b);return !p||(p!=='..'&&!p.startsWith(`..${sep}`)&&!isAbsolute(p));};
 if(overlaps(source,destination)||overlaps(destination,source))throw Error('打包目录不能覆盖或包含源素材目录');
 if(existsSync(destination)&&(!lstatSync(destination).isDirectory()||lstatSync(destination).isSymbolicLink()))throw Error('打包目标必须是实际目录');
 const checked=inspectCharacters(source),temporary=mkdtempSync(join(dirname(destination),'.bundle-characters-')),stage=join(temporary,'characters'),previous=join(temporary,'previous');
 try {
  mkdirSync(stage);
  for(const file of checked.files.keys()){
   mkdirSync(dirname(join(stage,file)),{recursive:true});
   copyFileSync(join(source,file),join(stage,file),constants.COPYFILE_FICLONE);
  }
  writeFileSync(join(stage,'catalog.json'),checked.catalogText);
  const verified=inspectCharacters(stage);
  if(verified.catalogText!==checked.catalogText||verified.files.size!==checked.files.size)throw Error('角色打包后清单不一致');
  for(const [file,expected] of checked.files){const actual=verified.files.get(file);if(actual?.sha256!==expected.sha256||actual.bytes!==expected.bytes)throw Error(`角色打包后内容不一致：${file}`);}
  if(readFileSync(join(stage,'catalog.json'),'utf8')!==checked.catalogText)throw Error('角色打包后目录清单不一致');
  // Rust embeds this small catalog; it must describe exactly the staged resources.
  writeFileSync(join(source,'catalog.json'),checked.catalogText);
  if(existsSync(destination))renameSync(destination,previous);
  try {renameSync(stage,destination);}catch(error){if(existsSync(previous))renameSync(previous,destination);throw error;}
  return {characters:checked.catalog.length,files:checked.files.size+1,bytes:checked.bytes};
 } finally {rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=stageCharacters(fileURLToPath(new URL('../resources/characters/',import.meta.url)),fileURLToPath(new URL('../artifacts/bundle-characters/',import.meta.url)));
 console.log(`已验证并暂存 ${result.characters} 个角色，${result.files} 个引用文件，${(result.bytes/1024**2).toFixed(2)} MiB；源素材保留。`);
}
