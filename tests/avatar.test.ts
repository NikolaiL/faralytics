import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarDisplayUrl, trustedAvatarUrl } from "../packages/nextjs/lib/avatar-url.ts";

test("known PFP hosts use a same-origin relay and Cloudflare avatars are resized", () => {
  const imgur = "https://i.imgur.com/lCDjOJL.jpg";
  assert.equal(avatarDisplayUrl(imgur), `/api/avatar?url=${encodeURIComponent(imgur)}`);
  assert.equal(trustedAvatarUrl("https://imagedelivery.net/account/image/original"), "https://imagedelivery.net/account/image/width=128,height=128,fit=cover");
  for (const url of ["https://media.firefly.land/lens/pfp.png", "https://res.cloudinary.com/base-app/image/upload/v1/pfp.png", "https://ipfs.decentralized-content.com/ipfs/cid"]) assert.equal(trustedAvatarUrl(url),url);
});
test("avatar relay rejects arbitrary destinations, credentials, ports and Cloudinary fetch URLs", () => {
  for (const url of ["http://i.imgur.com/pfp.jpg", "https://i.imgur.com.evil.test/pfp.jpg", "https://localhost/pfp.png", "https://127.0.0.1/pfp.png", "https://i.imgur.com:8080/pfp.jpg", "https://user:pass@i.imgur.com/pfp.jpg", "https://res.cloudinary.com/base-app/image/fetch/https://localhost/x", "data:image/png;base64,AA", "invalid"]) assert.equal(trustedAvatarUrl(url), null);
  assert.equal(avatarDisplayUrl("javascript:alert(1)"), null);
  assert.equal(avatarDisplayUrl("https://other-public-host.test/pfp.jpg"), "https://other-public-host.test/pfp.jpg");
});
