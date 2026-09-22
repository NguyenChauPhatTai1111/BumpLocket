import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import WebSocket from 'ws';
test('Reverb authorizes own private channel and delivers queued event',async({request})=>{
 const root=path.resolve('..');
 const fixture=JSON.parse(execFileSync('php',['tests/browser-fixture.php','create'],{cwd:root,encoding:'utf8'}));
 let ws;
 try{
  const login=await request.post('public/api/auth/login',{data:{login:fixture.a.email,password:fixture.password}});
  expect(login.ok()).toBeTruthy();const {token}=await login.json();
  const received=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('No private Reverb event after 15 seconds')),15000);
   ws=new WebSocket('ws://127.0.0.1:8080/app/bumplocket-local?protocol=7&client=js&version=8.4.0&flash=false',{origin:'https://chamcong.shop'});
   ws.onerror=()=>{clearTimeout(timeout);reject(new Error('Cannot connect to Reverb'))};
   ws.onmessage=async event=>{
    try{
     const packet=JSON.parse(event.data);
     if(packet.event==='pusher:connection_established'){
      const {socket_id}=JSON.parse(packet.data);
      const channel='private-user.'+fixture.a.id;
      const auth=await request.post('public/api/broadcasting/auth',{headers:{Authorization:'Bearer '+token},data:{socket_id,channel_name:channel}});
      expect(auth.ok()).toBeTruthy();
      ws.send(JSON.stringify({event:'pusher:subscribe',data:{channel,...await auth.json()}}));
     }
     if(packet.event==='pusher_internal:subscription_succeeded')execFileSync('php',['tests/browser-fixture.php','broadcast',String(fixture.a.id)],{cwd:root});
     if(packet.event==='LocationUpdated'){clearTimeout(timeout);resolve(JSON.parse(packet.data));}
     if(packet.event==='pusher:error')throw new Error(JSON.stringify(packet.data));
    }catch(e){clearTimeout(timeout);reject(e)}
   };
  });
  expect(received.status).toBe('test');
 }finally{ws?.close();execFileSync('php',['tests/browser-fixture.php','cleanup',String(fixture.a.id),String(fixture.b.id)],{cwd:root});}
});
