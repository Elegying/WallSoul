import type {Settings} from '../contracts';

/** Coalesce slider input; keep one full-settings write in flight at a time. */
export class SettingsQueue {
 private saved?:Settings;
 private pending:Partial<Settings>={};
 private active?:Partial<Settings>;
 private timer?:ReturnType<typeof setTimeout>;
 private saving?:Promise<boolean>;
 constructor(private write:(value:Settings)=>Promise<Settings>,private changed:(value:Settings)=>void,private failed:(error:unknown)=>void){}
 receive(value:Settings){this.saved=value;this.emit()}
 update(value:Partial<Settings>){
  if(!this.saved)return;
  this.pending={...this.pending,...value};this.emit();
  if(!this.timer)this.timer=setTimeout(()=>{void this.flush()},80);
 }
 private value(){return this.saved?{...this.saved,...this.active,...this.pending}:undefined}
 private emit(){const value=this.value();if(value)this.changed(value)}
 async flush():Promise<boolean>{
  if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
  if(this.saving){const ok=await this.saving;return (await this.flush())&&ok;}
  if(!this.saved||!Object.keys(this.pending).length)return true;
  this.active=this.pending;this.pending={};const value=this.value()!;
  this.saving=this.write(value).then(saved=>{this.saved=saved;return true}).catch(error=>{this.failed(error);return false}).finally(()=>{this.active=undefined;this.saving=undefined;this.emit()});
  const ok=await this.saving;
  return (await this.flush())&&ok;
 }
}
