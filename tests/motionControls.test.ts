import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {Character} from '../src/contracts';
import {MotionControls} from '../src/ui/MotionControls';

const character=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8')) as Character;
const render=(value:string,model=character)=>renderToStaticMarkup(createElement(MotionControls,{character:model,value,onChange:()=>{}}));

test('video character has one resting entry and maps the saved still setting to it',()=>{
 const html=render('still');
 assert.equal((html.match(/>自然静息<\/button>/g)??[]).length,1);
 assert.match(html,/aria-pressed="true">自然静息<\/button>/);
 assert.doesNotMatch(html,/安静待机/);
});
test('all-state demonstration is explicitly separated from normal companionship',()=>{
 const html=render('all-states');
 assert.match(html,/<details><summary>动画演示<\/summary>[\s\S]*不代表真实通话/);
 assert.match(html,/aria-pressed="true">全部状态演示<\/button>/);
 assert.match(html,/说话和聆听跟随声音/);
});
test('non-video portraits retain the existing quiet standby control',()=>{
 const original=structuredClone(character);original.portrait!.videoSpeech=false;
 const html=render('still',original);
 assert.match(html,/aria-pressed="true">安静待机<\/button>/);
 assert.doesNotMatch(html,/全部状态演示/);
});
