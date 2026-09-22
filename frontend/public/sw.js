// Never cache private photos, API responses or coordinates.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={title:'BumpLocket',body:'Bạn có lời mời Bump mới.'};
 try{data={...data,...event.data.json()}}catch{}
 event.waitUntil((async()=>{
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  tabs.forEach(tab=>tab.postMessage({type:'BUMP_PUSH',id:data.bumpId}));
  if(!tabs.some(tab=>tab.visibilityState==='visible')){
   await self.registration.showNotification(data.title,{body:data.body,tag:data.tag||'bump',icon:new URL('icon.svg',self.registration.scope).href,vibrate:[200,100,200],data:{url:data.url||self.registration.scope}});
  }
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL(event.notification.data?.url||self.registration.scope);
  if(target.origin!==self.location.origin)return;
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const tab=tabs.find(t=>t.url.startsWith(self.registration.scope));
  if(tab){await tab.focus();tab.postMessage({type:'BUMP_PUSH'});}
  else await self.clients.openWindow(target.href);
 })());
});
