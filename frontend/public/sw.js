// Cache only the public application shell. Never cache API responses, private photos or coordinates.
const SHELL_CACHE='bumplocket-shell-v2';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(SHELL_CACHE);
 await cache.addAll(['./','./index.html','./manifest.webmanifest','./icon.svg']);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith('bumplocket-shell-')&&key!==SHELL_CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||url.pathname.includes('/api/')||url.pathname.includes('/users/')||url.pathname.includes('/moments/')||url.pathname.includes('/stories/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(SHELL_CACHE).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));
  return;
 }
 if(['script','style','font','image'].includes(event.request.destination)){
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(SHELL_CACHE).then(cache=>cache.put(event.request,copy));}return response;})));
 }
});
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
