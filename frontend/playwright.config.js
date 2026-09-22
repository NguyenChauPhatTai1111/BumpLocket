import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',workers:1,timeout:120000,use:{baseURL:process.env.BROWSER_TEST_URL||'https://chamcong.shop/thiepcuoisonline/',channel:'msedge',headless:true,viewport:{width:1440,height:1000}},reporter:'list'});
