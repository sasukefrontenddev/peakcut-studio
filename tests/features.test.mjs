import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const server = await createServer({server:{middlewareMode:true},appType:'custom'});
const features = await server.ssrLoadModule('/src/StudioFeatures.jsx');
after(()=>server.close());
const render=(name,props)=>renderToStaticMarkup(createElement(features[name],props));

test('AI ratings preserve zero and explain their source without promising views',()=>{
 const html=render('ClipRating',{clip:{score:0,reason:'<script>untrusted</script>'},job:{ai:{used:true}}});
 assert.match(html,/0\/100/);assert.match(html,/AI highlight rating/);assert.match(html,/not a prediction of views/);
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
 const fallback=render('ClipRating',{clip:{score:50},job:{ai:{used:false}}});
 assert.match(fallback,/not selected by AI/);assert.ok(!fallback.includes('AI highlight rating'));
 assert.match(render('ClipRating',{clip:{},job:{}}),/Unrated/);
});
test('publishing queue shows scheduled, failed and published states with appropriate actions',()=>{
 const html=render('PublishingQueue',{overview:{paused:true,posts:[
 {id:'a',title:'Scheduled clip',platform:'youtube',status:'scheduled',due_at:1700000000},
 {id:'b',title:'Failed clip',platform:'tiktok',status:'failed',error:'Permission denied'},
 {id:'c',title:'Posted clip',platform:'instagram',status:'posted',url:'https://www.instagram.com/reel/example/'},
 ]}});
 for(const text of ['Resume publishing','Scheduled clip','Cancel','Retry','Permission denied','View post'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('undefined'));
});
test('creator form exposes auto-post destinations, scoring, spacing and live controls',()=>{
 const html=render('CreatorSettings',{creator:{id:'example',name:'Example',channels:{},accounts:['yt_1'],autopost:true},accounts:[{id:'yt_1',name:'My channel',platform:'youtube'}]});
 for(const text of ['Minimum auto-post score','Minutes between posts','Posts per account per day','Automatically publish','My channel','Live decision mode','Trigger words','Save creator settings']) assert.ok(html.includes(text),text);
 assert.match(html,/checked=""/);
});
test('account screen explains local HTTPS blockers and provides all platform setup entries',()=>{
 const html=render('SocialConnections',{accounts:[],connection:'offline'});
 for(const name of ['YouTube','Instagram','TikTok','public HTTPS engine address','Set up'])assert.ok(html.includes(name),name);
 assert.ok(!html.includes('Connect YouTube'));
});
