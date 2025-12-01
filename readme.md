# @futpib/fetch-cid

> Fetch IPFS content by CID with filesystem caching

[![npm](https://img.shields.io/npm/v/@futpib/fetch-cid.svg)](https://www.npmjs.com/package/@futpib/fetch-cid)
[![Coverage Status](https://coveralls.io/repos/github/futpib/fetch-cid/badge.svg?branch=master)](https://coveralls.io/github/futpib/fetch-cid?branch=master)

## Install

```
yarn add @futpib/fetch-cid
```

## Example

```js
import { fetchCid } from '@futpib/fetch-cid';

// Fetch by CID (cached to ~/.cache/fetch-cid.futpib.github.io/)
const stream = await fetchCid('bafybeicb3qajmwy6li7hche2nkucvytaxcyxhwhphmi73tgydjzmyoqoda');

for await (const chunk of stream) {
  console.log(chunk);
}

// Custom IPFS gateway
const stream2 = await fetchCid('bafybeicb3qajmwy6li7hche2nkucvytaxcyxhwhphmi73tgydjzmyoqoda', {
  ipfsBaseUrl: 'https://cloudflare-ipfs.com/ipfs/',
});
```
