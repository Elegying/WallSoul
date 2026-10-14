import {test} from 'node:test';import assert from 'node:assert/strict';import {keyGreen} from '../src/renderer/portrait';
test('compositing removes key backdrop and preserves skin and hair',()=>{assert.equal(keyGreen(0,255,0),0);assert.equal(keyGreen(248,213,195),1);assert.equal(keyGreen(22,18,23),1);assert.ok(keyGreen(80,140,90)>0&&keyGreen(80,140,90)<1)});
