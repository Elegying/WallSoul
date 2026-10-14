import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectPortraitMotion} from '../src/renderer/portraitMotion';
const clips=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8')).portrait.body.clips;
test('quiet companionship does not silently talk; all-state demo remains available',()=>{
 const idle=selectPortraitMotion(clips,'idle','auto');
 assert.ok(idle.clips.every(c=>!c.playback||c.playback==='idle'));
 assert.ok(idle.clips.some(c=>c.id==='joy'));assert.ok(idle.clips.some(c=>c.id==='resting-natural'));
 assert.equal(selectPortraitMotion(clips,'idle','all-states').clips.length,clips.length);
});
test('live sound overrides demonstrations and old still setting selects living rest',()=>{
 assert.ok(selectPortraitMotion(clips,'speaking','all-states').clips.every(c=>c.playback==='speaking'));
 assert.ok(selectPortraitMotion(clips,'listening','wave').clips.every(c=>c.playback==='listening'));
 assert.equal(selectPortraitMotion(clips,'idle','still').requested,'resting-natural');
});
