import test from 'node:test';
import assert from 'node:assert/strict';
import {audioPreferences,selectAudioSource} from '../src/ui/AudioPanel';
import type {Snapshot} from '../src/contracts';

test('audio selection never substitutes an unrelated app for a missing source',()=>{
 const browser={id:'browser',name:'浏览器'},music={id:'music',name:'音乐'},doubao={id:'doubao',name:'豆包'};
 assert.equal(selectAudioSource('',[browser,music]),'');
 assert.equal(selectAudioSource('',[browser,doubao]),'doubao');
 assert.equal(selectAudioSource('browser',[browser,doubao]),'browser');
 assert.equal(selectAudioSource('browser',[music,doubao]),'');
 assert.equal(selectAudioSource('doubao',[]),'');
});
test('remounted audio controls use saved preferences instead of the stopped session source',()=>{
 const s={settings:{audioSource:'doubao',micThresholdDb:-45},audio:{enabled:false,source:'old-browser'}} as Snapshot;
 assert.deepEqual(audioPreferences(s),{source:'doubao',threshold:-45});
 s.audio!.enabled=true;assert.equal(audioPreferences(s).source,'old-browser');
 s.audio!.enabled=false;
 for(let i=0;i<3;i++)assert.equal(selectAudioSource(audioPreferences(s).source,[{id:'browser',name:'浏览器'}]),'');
 assert.deepEqual(audioPreferences({settings:{},audio:{enabled:false,source:'old-browser'}} as Snapshot),{source:'',threshold:-38});
});
