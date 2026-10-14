import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
test('facial study preserves the accepted source and valid original-projected topology',()=>{
 const d=JSON.parse(readFileSync(new URL('../resources/face-lab/face.json',import.meta.url),'utf8'));
 const source=readFileSync(new URL('../resources/characters/soul/neutral.png',import.meta.url));
 assert.equal(createHash('sha256').update(source).digest('hex'),d.referenceSha256);
 assert.equal(d.points.length,468);assert.equal(d.triangles.length%3,0);
 for(const i of d.triangles)assert.ok(Number.isInteger(i)&&i>=0&&i<d.points.length);
 for(const p of d.points)assert.ok(p.length===3&&p.every(Number.isFinite));
 const dental=JSON.parse(readFileSync(new URL('../resources/face-lab/dental-reference.json',import.meta.url),'utf8'));
 assert.equal(dental.source,'/characters/soul/speaking.png');assert.ok(dental.points[308][0]>dental.points[78][0]);
});
